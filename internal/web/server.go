package web

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/yanzyuyu/yrcrouter/internal/config"
	"github.com/yanzyuyu/yrcrouter/internal/router"
)

type Server struct {
	store   *config.Store
	engine  *router.Engine
	distDir string
}

func NewServer(store *config.Store, engine *router.Engine) *Server {
	distPath := "frontend/dist"
	if _, err := os.Stat(distPath); err != nil {
		distPath = ""
	}

	return &Server{
		store:   store,
		engine:  engine,
		distDir: distPath,
	}
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/config", s.handleConfig)

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
