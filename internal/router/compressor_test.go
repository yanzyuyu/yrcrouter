package router

import (
	"testing"
)

func TestCompressText(t *testing.T) {
	input := "line1    \n\n\n\nline2    \ndiff --git a/file.go b/file.go\nindex 1234567..89abcdef 100644\ncode"
	out, saved := CompressText(input)
	if saved <= 0 {
		t.Fatalf("expected positive saved bytes, got %d", saved)
	}
	if len(out) >= len(input) {
		t.Fatalf("expected compressed text to be shorter than input")
	}
}

func TestCompressRequest(t *testing.T) {
	req := &ChatCompletionRequest{
		Model: "gemini-2.5-flash",
		Messages: []ChatMessage{
			{Role: "user", Content: "hello world\n\n\n\n\n\nmore text\n    \n"},
		},
	}
	saved := CompressRequest(req)
	if saved <= 0 {
		t.Fatalf("expected positive saved bytes, got %d", saved)
	}
}
