package router

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/yanzyuyu/yrcrouter/internal/config"
)

type Engine struct {
	store      *config.Store
	startTime  time.Time
	httpClient *http.Client

	totalRequests   atomic.Int64
	successRequests atomic.Int64
	failedRequests  atomic.Int64
	fallbackHits    atomic.Int64
	savedTokensEst  atomic.Int64

	logsMu sync.RWMutex
	logs   []TrafficLog
}

func NewEngine(store *config.Store) *Engine {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		IdleConnTimeout:     90 * time.Second,
	}

	return &Engine{
		store:      store,
		startTime:  time.Now(),
		httpClient: &http.Client{Transport: transport, Timeout: 120 * time.Second},
		logs:       make([]TrafficLog, 0, 100),
	}
}

func (e *Engine) generateID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (e *Engine) recordLog(logItem TrafficLog) {
	e.logsMu.Lock()
	defer e.logsMu.Unlock()

	e.logs = append(e.logs, logItem)
	if len(e.logs) > 100 {
		e.logs = e.logs[len(e.logs)-100:]
	}
}

func (e *Engine) GetRecentLogs(limit int) []TrafficLog {
	e.logsMu.RLock()
	defer e.logsMu.RUnlock()

	total := len(e.logs)
	if limit <= 0 || limit > total {
		limit = total
	}

	result := make([]TrafficLog, limit)
	for i := 0; i < limit; i++ {
		result[i] = e.logs[total-1-i]
	}
	return result
}

func (e *Engine) GetMetrics() Metrics {
	uptime := int64(time.Since(e.startTime).Seconds())
	return Metrics{
		TotalRequests:   e.totalRequests.Load(),
		SuccessRequests: e.successRequests.Load(),
		FailedRequests:  e.failedRequests.Load(),
		FallbackHits:    e.fallbackHits.Load(),
		SavedTokensEst:  e.savedTokensEst.Load(),
		UptimeSeconds:   uptime,
	}
}

func (e *Engine) resolveCandidates(modelName string) []config.Provider {
	cfg := e.store.Get()
	var exact []config.Provider
	var fallback []config.Provider

	for _, p := range cfg.Providers {
		if !p.Enabled {
			continue
		}
		hasModel := false
		for _, m := range p.Models {
			if strings.EqualFold(m, modelName) {
				hasModel = true
				break
			}
		}
		if hasModel {
			exact = append(exact, p)
		} else {
			fallback = append(fallback, p)
		}
	}

	sort.SliceStable(exact, func(i, j int) bool {
		return exact[i].Tier < exact[j].Tier
	})

	sort.SliceStable(fallback, func(i, j int) bool {
		return fallback[i].Tier < fallback[j].Tier
	})

	return append(exact, fallback...)
}

func (e *Engine) HandleModels(w http.ResponseWriter, r *http.Request) {
	cfg := e.store.Get()
	seen := make(map[string]bool)
	var items []ModelItem
	now := time.Now().Unix()

	for _, p := range cfg.Providers {
		if !p.Enabled {
			continue
		}
		for _, m := range p.Models {
			if !seen[m] {
				seen[m] = true
				items = append(items, ModelItem{
					ID:      m,
					Object:  "model",
					Created: now,
					OwnedBy: p.ID,
				})
			}
		}
	}

	if cfg.DefaultModel != "" && !seen[cfg.DefaultModel] {
		items = append(items, ModelItem{
			ID:      cfg.DefaultModel,
			Object:  "model",
			Created: now,
			OwnedBy: "system",
		})
	}

	resp := ModelListResponse{
		Object: "list",
		Data:   items,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (e *Engine) HandleChatCompletions(w http.ResponseWriter, r *http.Request) {
	e.totalRequests.Add(1)
	start := time.Now()

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		e.failedRequests.Add(1)
		http.Error(w, `{"error":{"message":"Failed to read request body"}}`, http.StatusBadRequest)
		return
	}

	var chatReq ChatCompletionRequest
	if err := json.Unmarshal(bodyBytes, &chatReq); err != nil {
		e.failedRequests.Add(1)
		http.Error(w, `{"error":{"message":"Invalid JSON payload"}}`, http.StatusBadRequest)
		return
	}

	cfg := e.store.Get()
	if chatReq.Model == "" {
		chatReq.Model = cfg.DefaultModel
	}

	savedBytes := 0
	if cfg.CompressTokens {
		savedBytes = CompressRequest(&chatReq)
		if savedBytes > 0 {
			e.savedTokensEst.Add(int64(savedBytes / 4))
			newBody, err := json.Marshal(chatReq)
			if err == nil {
				bodyBytes = newBody
			}
		}
	}

	candidates := e.resolveCandidates(chatReq.Model)
	if len(candidates) == 0 {
		e.failedRequests.Add(1)
		http.Error(w, `{"error":{"message":"No enabled providers available for routing"}}`, http.StatusServiceUnavailable)
		return
	}

	var lastStatusCode int
	var lastErr error
	var chosenProvider config.Provider

	for idx, provider := range candidates {
		if idx > 0 {
			e.fallbackHits.Add(1)
		}

		chosenProvider = provider
		reqURL := strings.TrimRight(provider.BaseURL, "/") + "/chat/completions"

		outReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}

		outReq.Header.Set("Content-Type", "application/json")
		if provider.APIKey != "" {
			outReq.Header.Set("Authorization", "Bearer "+provider.APIKey)
		}

		if provider.ID == "openrouter" {
			outReq.Header.Set("HTTP-Referer", "https://github.com/yanzyuyu/yrcrouter")
			outReq.Header.Set("X-Title", "yrcrouter")
		}

		resp, err := e.httpClient.Do(outReq)
		if err != nil {
			lastErr = err
			lastStatusCode = http.StatusBadGateway
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			lastStatusCode = resp.StatusCode
			_ = resp.Body.Close()
			continue
		}

		lastStatusCode = resp.StatusCode
		e.proxyResponse(w, resp, chatReq.Stream)
		_ = resp.Body.Close()

		latency := time.Since(start).Milliseconds()
		if lastStatusCode >= 200 && lastStatusCode < 300 {
			e.successRequests.Add(1)
		} else {
			e.failedRequests.Add(1)
		}

		e.recordLog(TrafficLog{
			ID:         e.generateID(),
			Timestamp:  time.Now().Format("15:04:05"),
			Model:      chatReq.Model,
			Provider:   chosenProvider.Name,
			StatusCode: lastStatusCode,
			LatencyMs:  latency,
			Stream:     chatReq.Stream,
			SavedBytes: savedBytes,
		})
		return
	}

	e.failedRequests.Add(1)
	latency := time.Since(start).Milliseconds()
	e.recordLog(TrafficLog{
		ID:         e.generateID(),
		Timestamp:  time.Now().Format("15:04:05"),
		Model:      chatReq.Model,
		Provider:   chosenProvider.Name,
		StatusCode: lastStatusCode,
		LatencyMs:  latency,
		Stream:     chatReq.Stream,
		SavedBytes: savedBytes,
	})

	status := lastStatusCode
	if status == 0 {
		status = http.StatusBadGateway
	}
	msg := fmt.Sprintf(`{"error":{"message":"All upstream providers failed","last_status":%d,"detail":%q}}`, status, fmt.Sprint(lastErr))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(msg))
}

func (e *Engine) proxyResponse(w http.ResponseWriter, upstreamResp *http.Response, isStream bool) {
	for k, vv := range upstreamResp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}

	if isStream {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(upstreamResp.StatusCode)

		flusher, ok := w.(http.Flusher)
		if !ok {
			_, _ = io.Copy(w, upstreamResp.Body)
			return
		}

		buf := make([]byte, 4096)
		for {
			n, err := upstreamResp.Body.Read(buf)
			if n > 0 {
				_, _ = w.Write(buf[:n])
				flusher.Flush()
			}
			if err != nil {
				break
			}
		}
		return
	}

	w.WriteHeader(upstreamResp.StatusCode)
	_, _ = io.Copy(w, upstreamResp.Body)
}
