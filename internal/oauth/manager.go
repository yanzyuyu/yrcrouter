package oauth

import (
	"errors"
	"sync"
	"time"
)

type PKCESession struct {
	State        string    `json:"state"`
	CodeVerifier string    `json:"code_verifier"`
	ProviderID   string    `json:"provider_id"`
	CreatedAt    time.Time `json:"created_at"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]PKCESession
}

func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]PKCESession),
	}
}

func (m *Manager) StartPKCE(providerID string) (authURL string, state string, codeVerifier string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	state = GenerateState()
	codeVerifier = GenerateCodeVerifier(32)
	codeChallenge := GenerateCodeChallenge(codeVerifier)

	session := PKCESession{
		State:        state,
		CodeVerifier: codeVerifier,
		ProviderID:   providerID,
		CreatedAt:    time.Now(),
	}
	m.sessions[state] = session

	switch providerID {
	case "antigravity":
		clientID, _ := GetAntigravityCredentials()
		authURL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + clientID + "&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A20128%2Fcallback&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&access_type=offline&prompt=consent&state=" + state
	case "claude":
		authURL = "https://claude.ai/login/oauth/authorize?client_id=claude-code&response_type=code&code_challenge=" + codeChallenge + "&code_challenge_method=S256&state=" + state
	case "gemini":
		authURL = "https://accounts.google.com/o/oauth2/v2/auth?client_id=gemini-cli&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A20128%2Fapi%2Foauth%2Fcallback&scope=email%20profile&code_challenge=" + codeChallenge + "&code_challenge_method=S256&state=" + state
	default:
		authURL = "https://github.com/yanzyuyu/yrcrouter"
	}

	return authURL, state, codeVerifier
}

func (m *Manager) GetVerifier(state string) (string, string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[state]
	if !exists {
		return "", "", errors.New("invalid or expired oauth state")
	}
	delete(m.sessions, state)
	return session.CodeVerifier, session.ProviderID, nil
}
