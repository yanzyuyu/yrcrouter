package router

import (
	"regexp"
	"strings"
)

var (
	regexExcessNewlines = regexp.MustCompile(`\n{3,}`)
	regexTrailingSpaces = regexp.MustCompile(`[ \t]+\n`)
	regexGitDiffIndex   = regexp.MustCompile(`index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}( [0-9]{6})?`)
	regexGitDiffHeader  = regexp.MustCompile(`diff --git a/(.*) b/(.*)`)
)

func CompressText(raw string) (string, int) {
	if len(raw) < 16 {
		return raw, 0
	}

	originalLen := len(raw)
	res := raw

	res = regexTrailingSpaces.ReplaceAllString(res, "\n")
	res = regexExcessNewlines.ReplaceAllString(res, "\n\n")

	if strings.Contains(res, "diff --git") {
		res = regexGitDiffIndex.ReplaceAllString(res, "")
		res = regexGitDiffHeader.ReplaceAllString(res, "diff: $1")
	}

	savedBytes := originalLen - len(res)
	if savedBytes < 0 {
		savedBytes = 0
	}

	return res, savedBytes
}

func CompressRequest(req *ChatCompletionRequest) int {
	totalSaved := 0
	for i := range req.Messages {
		if strContent, ok := req.Messages[i].Content.(string); ok {
			compressed, saved := CompressText(strContent)
			if saved > 0 {
				req.Messages[i].Content = compressed
				totalSaved += saved
			}
		}
	}
	return totalSaved
}
