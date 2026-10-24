package web

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/yanzyuyu/yrcrouter/internal/config"
	"github.com/yanzyuyu/yrcrouter/internal/oauth"
	"github.com/yanzyuyu/yrcrouter/internal/router"
)

type Server struct {
	store        *config.Store
	engine       *router.Engine
	oauthManager *oauth.Manager
	distDir      string
}

func NewServer(store *config.Store, engine *router.Engine) *Server {
	distPath := "frontend/dist"
	if _, err := os.Stat(distPath); err != nil {
		distPath = ""
	}

	return &Server{
		store:        store,
		engine:       engine,
		oauthManager: oauth.NewManager(),
		distDir:      distPath,
	}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/config", s.handleConfig)

	mux.HandleFunc("/api/oauth/github/device-code", s.handleGitHubDeviceCode)
	mux.HandleFunc("/api/oauth/github/poll", s.handleGitHubPoll)
	mux.HandleFunc("/api/oauth/pkce-start", s.handlePKCEStart)
	mux.HandleFunc("/api/oauth/import-token", s.handleImportToken)

	mux.HandleFunc("/v1/models", s.engine.HandleModels)
	mux.HandleFunc("/v1/chat/completions", s.engine.HandleChatCompletions)

	if s.distDir != "" {
		assetsDir := filepath.Join(s.distDir, "assets")
		mux.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(assetsDir))))
	}

	mux.HandleFunc("/", s.handleIndex)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if s.distDir != "" {
		indexPath := filepath.Join(s.distDir, "index.html")
		if data, err := os.ReadFile(indexPath); err == nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(data)
			return
		}
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	_, _ = w.Write([]byte("Frontend bundle not found. Please run 'npm run build' inside frontend directory."))
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	metrics := s.engine.GetMetrics()
	logs := s.engine.GetRecentLogs(30)
	cfg := s.store.Get()

	res := map[string]interface{}{
		"metrics": metrics,
		"config":  cfg,
		"logs":    logs,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		cfg := s.store.Get()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cfg)
		return
	}

	if r.Method == http.MethodPost {
		var newCfg config.Config
		if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
			http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
			return
		}
		if err := s.store.Update(newCfg); err != nil {
			http.Error(w, `{"error":"Failed to save configuration"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"updated"}`))
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleGitHubDeviceCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	resp, err := oauth.RequestGitHubDeviceCode()
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleGitHubPoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		DeviceCode string `json:"device_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.DeviceCode == "" {
		http.Error(w, `{"error":"Missing device_code"}`, http.StatusBadRequest)
		return
	}

	tr, err := oauth.PollGitHubAccessToken(payload.DeviceCode)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	if tr.AccessToken != "" {
		copilotToken, err := oauth.FetchCopilotToken(tr.AccessToken)
		finalToken := tr.AccessToken
		if err == nil && copilotToken != "" {
			finalToken = copilotToken
		}

		cfg := s.store.Get()
		for i := range cfg.Providers {
			if cfg.Providers[i].ID == "github_copilot" || cfg.Providers[i].ID == "github" {
				cfg.Providers[i].APIKey = finalToken
				cfg.Providers[i].Enabled = true
			}
		}
		_ = s.store.Update(cfg)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"authenticated","token":"` + finalToken + `"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tr)
}

func (s *Server) handlePKCEStart(w http.ResponseWriter, r *http.Request) {
	provider := r.URL.Query().Get("provider")
	if provider == "" {
		provider = "claude"
	}

	authURL, state, verifier := s.oauthManager.StartPKCE(provider)
	res := map[string]string{
		"auth_url":      authURL,
		"state":         state,
		"code_verifier": verifier,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (s *Server) handleImportToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		ProviderID string `json:"provider_id"`
		Token      string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.ProviderID == "" || payload.Token == "" {
		http.Error(w, `{"error":"Missing provider_id or token"}`, http.StatusBadRequest)
		return
	}

	cfg := s.store.Get()
	updated := false
	for i := range cfg.Providers {
		if cfg.Providers[i].ID == payload.ProviderID {
			cfg.Providers[i].APIKey = payload.Token
			cfg.Providers[i].Enabled = true
			updated = true
			break
		}
	}

	if updated {
		_ = s.store.Update(cfg)
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"imported","provider_id":"` + payload.ProviderID + `"}`))
}
