package web

import (
	"encoding/json"
	"net/http"

	"github.com/yanzyuyu/yrcrouter/internal/config"
	"github.com/yanzyuyu/yrcrouter/internal/router"
)

type Server struct {
	store  *config.Store
	engine *router.Engine
}

func NewServer(store *config.Store, engine *router.Engine) *Server {
	return &Server{
		store:  store,
		engine: engine,
	}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/static/app.css", s.handleCSS)
	mux.HandleFunc("/static/app.js", s.handleJS)
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/config", s.handleConfig)

	mux.HandleFunc("/v1/models", s.engine.HandleModels)
	mux.HandleFunc("/v1/chat/completions", s.engine.HandleChatCompletions)
}

func (s *Server) handleCSS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	_, _ = w.Write([]byte(assetAppCSS))
}

func (s *Server) handleJS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	_, _ = w.Write([]byte(assetAppJS))
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" && r.URL.Path != "/dashboard" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(assetIndexHTML))
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	metrics := s.engine.GetMetrics()
	logs := s.engine.GetRecentLogs(20)
	cfg := s.store.Get()

	for i := range cfg.Providers {
		if cfg.Providers[i].APIKey != "" {
			cfg.Providers[i].APIKey = "••••••••"
		}
	}

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
