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
	Category string   `json:"category"`
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
				ID:       "openrouter",
				Name:     "OpenRouter",
				Category: "Aggregator",
				BaseURL:  "https://openrouter.ai/api/v1",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"openrouter/auto", "google/gemini-2.5-flash", "anthropic/claude-3.7-sonnet", "deepseek/deepseek-chat"},
			},
			{
				ID:       "antigravity",
				Name:     "Google Antigravity",
				Category: "Cloud",
				BaseURL:  "https://generativelanguage.googleapis.com/v1beta/openai",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"antigravity/claude-3-7-sonnet", "antigravity/claude-3-5-sonnet", "antigravity/gemini-2.5-pro", "antigravity/gemini-2.5-flash"},
			},
			{
				ID:       "github_copilot",
				Name:     "GitHub Copilot",
				Category: "Cloud",
				BaseURL:  "https://api.individual.githubcopilot.com",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"gpt-4o", "claude-3.5-sonnet", "o1-preview"},
			},
			{
				ID:       "groq",
				Name:     "Groq",
				Category: "High-Speed",
				BaseURL:  "https://api.groq.com/openai/v1",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"},
			},
			{
				ID:       "cerebras",
				Name:     "Cerebras",
				Category: "High-Speed",
				BaseURL:  "https://api.cerebras.ai/v1",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"llama3.1-70b", "llama3.1-8b"},
			},
			{
				ID:       "sambanova",
				Name:     "SambaNova",
				Category: "High-Speed",
				BaseURL:  "https://api.sambanova.ai/v1",
				APIKey:   "",
				Tier:     1,
				Enabled:  true,
				Models:   []string{"Meta-Llama-3.3-70B-Instruct", "Qwen2.5-72B-Instruct"},
			},
			{
				ID:       "deepseek",
				Name:     "DeepSeek",
				Category: "Cloud",
				BaseURL:  "https://api.deepseek.com",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"deepseek-chat", "deepseek-reasoner"},
			},
			{
				ID:       "gemini",
				Name:     "Google Gemini",
				Category: "Cloud",
				BaseURL:  "https://generativelanguage.googleapis.com/v1beta/openai",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"},
			},
			{
				ID:       "openai",
				Name:     "OpenAI",
				Category: "Cloud",
				BaseURL:  "https://api.openai.com/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"gpt-4o", "gpt-4o-mini", "o1", "o3-mini"},
			},
			{
				ID:       "anthropic",
				Name:     "Anthropic",
				Category: "Cloud",
				BaseURL:  "https://api.anthropic.com/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"},
			},
			{
				ID:       "mistral",
				Name:     "Mistral AI",
				Category: "Cloud",
				BaseURL:  "https://api.mistral.ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"mistral-large-latest", "codestral-latest", "mistral-small-latest"},
			},
			{
				ID:       "perplexity",
				Name:     "Perplexity",
				Category: "Search",
				BaseURL:  "https://api.perplexity.ai",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"sonar-reasoning", "sonar-pro", "sonar"},
			},
			{
				ID:       "together",
				Name:     "Together AI",
				Category: "Cloud",
				BaseURL:  "https://api.together.xyz/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"Qwen/Qwen2.5-Coder-32B-Instruct", "meta-llama/Llama-3.3-70B-Instruct-Turbo"},
			},
			{
				ID:       "fireworks",
				Name:     "Fireworks AI",
				Category: "Cloud",
				BaseURL:  "https://api.fireworks.ai/inference/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"accounts/fireworks/models/deepseek-v3", "accounts/fireworks/models/llama-v3p3-70b-instruct"},
			},
			{
				ID:       "siliconflow",
				Name:     "SiliconFlow",
				Category: "Asian LLM",
				BaseURL:  "https://api.siliconflow.cn/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-Coder-32B-Instruct"},
			},
			{
				ID:       "xai",
				Name:     "xAI (Grok)",
				Category: "Cloud",
				BaseURL:  "https://api.x.ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"grok-2-1212", "grok-2-vision-1212"},
			},
			{
				ID:       "cohere",
				Name:     "Cohere",
				Category: "Cloud",
				BaseURL:  "https://api.cohere.ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"command-r-plus-08-2024", "command-r-08-2024"},
			},
			{
				ID:       "novita",
				Name:     "Novita AI",
				Category: "Cloud",
				BaseURL:  "https://api.novita.ai/v3/openai",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"deepseek/deepseek-v3", "meta-llama/llama-3.3-70b-instruct"},
			},
			{
				ID:       "hyperbolic",
				Name:     "Hyperbolic",
				Category: "Cloud",
				BaseURL:  "https://api.hyperbolic.xyz/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"deepseek-ai/DeepSeek-V3", "meta-llama/Llama-3.3-70B-Instruct"},
			},
			{
				ID:       "nebius",
				Name:     "Nebius AI",
				Category: "Cloud",
				BaseURL:  "https://api.studio.nebius.ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"meta-llama/Meta-Llama-3.1-70B-Instruct"},
			},
			{
				ID:       "deepinfra",
				Name:     "DeepInfra",
				Category: "Cloud",
				BaseURL:  "https://api.deepinfra.com/v1/openai",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"meta-llama/Meta-Llama-3.1-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct"},
			},
			{
				ID:       "cloudflare",
				Name:     "Cloudflare AI",
				Category: "Serverless",
				BaseURL:  "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT/ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"@cf/meta/llama-3.3-70b-instruct"},
			},
			{
				ID:       "ai21",
				Name:     "AI21 Labs",
				Category: "Cloud",
				BaseURL:  "https://api.ai21.com/studio/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"jamba-1.5-large", "jamba-1.5-mini"},
			},
			{
				ID:       "upstage",
				Name:     "Upstage Solar",
				Category: "Asian LLM",
				BaseURL:  "https://api.upstage.ai/v1/solar",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"solar-pro", "solar-mini"},
			},
			{
				ID:       "minimax",
				Name:     "MiniMax",
				Category: "Asian LLM",
				BaseURL:  "https://api.minimax.chat/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"abab6.5s-chat"},
			},
			{
				ID:       "moonshot",
				Name:     "Moonshot (Kimi)",
				Category: "Asian LLM",
				BaseURL:  "https://api.moonshot.cn/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"moonshot-v1-8k", "moonshot-v1-32k"},
			},
			{
				ID:       "zhipu",
				Name:     "Zhipu (GLM)",
				Category: "Asian LLM",
				BaseURL:  "https://open.bigmodel.cn/api/paas/v4",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"glm-4-plus", "glm-4-flash"},
			},
			{
				ID:       "baichuan",
				Name:     "Baichuan",
				Category: "Asian LLM",
				BaseURL:  "https://api.baichuan-ai.com/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"Baichuan4", "Baichuan3-Turbo"},
			},
			{
				ID:       "yi",
				Name:     "01.AI (Yi)",
				Category: "Asian LLM",
				BaseURL:  "https://api.01.ai/v1",
				APIKey:   "",
				Tier:     2,
				Enabled:  true,
				Models:   []string{"yi-lightning", "yi-large"},
			},
			{
				ID:       "ollama",
				Name:     "Ollama (Local)",
				Category: "Local",
				BaseURL:  "http://localhost:11434/v1",
				APIKey:   "ollama",
				Tier:     3,
				Enabled:  true,
				Models:   []string{"qwen2.5-coder", "llama3.2", "deepseek-r1"},
			},
			{
				ID:       "lmstudio",
				Name:     "LM Studio (Local)",
				Category: "Local",
				BaseURL:  "http://localhost:1234/v1",
				APIKey:   "",
				Tier:     3,
				Enabled:  true,
				Models:   []string{"local-model"},
			},
			{
				ID:       "vllm",
				Name:     "vLLM (Local)",
				Category: "Local",
				BaseURL:  "http://localhost:8000/v1",
				APIKey:   "token",
				Tier:     3,
				Enabled:  true,
				Models:   []string{"default"},
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
