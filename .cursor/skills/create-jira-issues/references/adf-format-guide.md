# Atlassian Document Format (ADF) Guide

ADF is the JSON format required for rich-text fields in Jira (primarily the acceptance criteria field). Plain text or markdown will fail for these fields.

## When ADF Is Required

| Field | Format | Notes |
|-------|--------|-------|
| Acceptance Criteria (`{{acceptanceCriteriaFieldId}}`) | **ADF JSON** | Not available for Bug issue types |
| Description | Markdown (auto-converted) | Do NOT use ADF for description |
| Summary | Plain text | Simple string |
| Comments | Markdown | Auto-converted by API |

## ADF Document Structure

Every ADF document follows this top-level structure:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    // Array of block-level nodes
  ]
}
```

## Block-Level Nodes

### Paragraph

```json
{
  "type": "paragraph",
  "content": [
    {"type": "text", "text": "Paragraph text here"}
  ]
}
```

### Bullet List

```json
{
  "type": "bulletList",
  "content": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [{"type": "text", "text": "First item"}]
        }
      ]
    },
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [{"type": "text", "text": "Second item"}]
        }
      ]
    }
  ]
}
```

### Ordered List

```json
{
  "type": "orderedList",
  "content": [
    {
      "type": "listItem",
      "content": [
        {
          "type": "paragraph",
          "content": [{"type": "text", "text": "Step 1"}]
        }
      ]
    }
  ]
}
```

### Heading

```json
{
  "type": "heading",
  "attrs": {"level": 2},
  "content": [
    {"type": "text", "text": "Section Title"}
  ]
}
```

### Code Block

```json
{
  "type": "codeBlock",
  "attrs": {"language": "python"},
  "content": [
    {"type": "text", "text": "def example():\n    pass"}
  ]
}
```

## Inline Marks (Text Formatting)

### Bold

```json
{"type": "text", "text": "bold text", "marks": [{"type": "strong"}]}
```

### Italic

```json
{"type": "text", "text": "italic text", "marks": [{"type": "em"}]}
```

### Code

```json
{"type": "text", "text": "inline code", "marks": [{"type": "code"}]}
```

### Link

```json
{"type": "text", "text": "click here", "marks": [{"type": "link", "attrs": {"href": "https://example.com"}}]}
```

## Acceptance Criteria Pattern

The standard pattern for acceptance criteria in this project:

```json
{
  "{{acceptanceCriteriaFieldId}}": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "I know this is done when:"}]
      },
      {
        "type": "bulletList",
        "content": [
          {
            "type": "listItem",
            "content": [
              {
                "type": "paragraph",
                "content": [{"type": "text", "text": "First acceptance criterion"}]
              }
            ]
          },
          {
            "type": "listItem",
            "content": [
              {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Second acceptance criterion"}]
              }
            ]
          },
          {
            "type": "listItem",
            "content": [
              {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Third acceptance criterion"}]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## Multi-Section Acceptance Criteria

For complex stories with grouped criteria:

```json
{
  "{{acceptanceCriteriaFieldId}}": {
    "type": "doc",
    "version": 1,
    "content": [
      {
        "type": "paragraph",
        "content": [{"type": "text", "text": "I know this is done when:"}]
      },
      {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "Functional"}]
      },
      {
        "type": "bulletList",
        "content": [
          {
            "type": "listItem",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Feature works as specified"}]}]
          }
        ]
      },
      {
        "type": "heading",
        "attrs": {"level": 3},
        "content": [{"type": "text", "text": "Non-Functional"}]
      },
      {
        "type": "bulletList",
        "content": [
          {
            "type": "listItem",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Response time < 200ms at P99"}]}]
          }
        ]
      }
    ]
  }
}
```

## Common Mistakes

| Mistake | Result | Fix |
|---------|--------|-----|
| Using plain text for AC field | API error | Use ADF JSON structure |
| Missing `version: 1` in doc | Validation failure | Always include `"version": 1` |
| Missing paragraph wrapper in listItem | Rendering issue | Every listItem must contain a paragraph node |
| Combining AC (ADF) with description (markdown) in one call | "Failed to convert markdown to adf" | Use separate API calls |
| Using ADF for the description field | Unnecessary complexity | Use markdown for description; API converts it |
