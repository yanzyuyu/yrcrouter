package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Provider struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	BaseURL  string   `json:"base_url"`
	APIKey   string   `json:"api_key"`
	Tier     int      `json:"tier"`
	Enabled  bool     `json:"enabled"`
	Models   []string `json:"models"`
}

type Config struct {
	Port           int        `json:"port"`
	SecretKey      string     `json:"secret_key"`
	CompressTokens bool       `json:"compress_tokens"`
	DefaultModel   string     `json:"default_model"`
	Providers      []Provider `json:"providers"`
}

type Store struct {
	mu     sync.RWMutex
	path   string
	config Config
}

func DefaultConfig() Config {
	return Config{
		Port:           20128,
		SecretKey:      "",
		CompressTokens: true,
		DefaultModel:   "gemini-2.5-flash",
		Providers: []Provider{
			{
				ID:      "openrouter",
				Name:    "OpenRouter",
				BaseURL: "https://openrouter.ai/api/v1",
				APIKey:  "",
				Tier:    1,
				Enabled: true,
				Models:  []string{"openrouter/auto", "google/gemini-2.5-flash", "anthropic/claude-3.7-sonnet"},
			},
			{
				ID:      "groq",
				Name:    "Groq",
				BaseURL: "https://api.groq.com/openai/v1",
				APIKey:  "",
				Tier:    1,
				Enabled: true,
				Models:  []string{"llama-3.3-70b-versatile", "llama-3.1-8b-instant"},
			},
			{
				ID:      "deepseek",
				Name:    "DeepSeek",
				BaseURL: "https://api.deepseek.com",
				APIKey:  "",
				Tier:    2,
				Enabled: true,
				Models:  []string{"deepseek-chat", "deepseek-reasoner"},
			},
			{
				ID:      "gemini",
				Name:    "Google Gemini",
				BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
				APIKey:  "",
				Tier:    2,
				Enabled: true,
				Models:  []string{"gemini-2.5-flash", "gemini-2.5-pro"},
			},
			{
				ID:      "ollama",
				Name:    "Ollama (Local)",
				BaseURL: "http://localhost:11434/v1",
				APIKey:  "ollama",
				Tier:    3,
				Enabled: true,
				Models:  []string{"qwen2.5-coder", "llama3.2"},
			},
		},
	}
}

func NewStore(cfgPath string) (*Store, error) {
	if cfgPath == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			cfgPath = "config.json"
		} else {
			cfgDir := filepath.Join(homeDir, ".config", "yrcrouter")
			_ = os.MkdirAll(cfgDir, 0755)
			cfgPath = filepath.Join(cfgDir, "config.json")
		}
	}

	store := &Store{path: cfgPath}
	if err := store.load(); err != nil {
		store.config = DefaultConfig()
		_ = store.save()
	}
	return store, nil
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	s.config = cfg
	return nil
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0600)
}

func (s *Store) Get() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *Store) Update(cfg Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
	return s.save()
}
