# Sandpiper Custom Header Implementation Plan

## 1. Component Structure

Create a custom TUI component that implements the Component interface:

```typescript
import type { Component, Theme } from "@mariozechner/pi-tui";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

class SandpiperHeaderComponent implements Component {
  private cachedWidth?: number;
  private cachedLines?: string[];
  
  constructor(private ctx: ExtensionAPI) {}
  
  render(width: number): string[] {
    // Implementation here
  }
  
  invalidate(): void {
    // Clear caches
  }
}
```

## 2. Data Sources

The component will need to access various data sources:

1. **App Identity & Version**: From ExtensionAPI context
2. **Model Information**: From ctx.model
3. **Keybinding Hints**: From ctx.keybindings
4. **Resource Listings**: From ctx.resourceLoader
5. **Theme Information**: From render() theme parameter

## 3. Layout Implementation

### 3.1 Two-Column Structure
- Calculate column widths (30% left, 70% right)
- Create divider lines using DynamicBorder
- Implement cell-based layout

### 3.2 Left Column Content
- Sandpiper ASCII art (5-8 lines)
- App identity and version
- Model information

### 3.3 Right Column Content
- Keybinding hints (vertically stacked cells)
- Resource listings (vertically stacked cells)

## 4. Key Implementation Details

### 4.1 Mascot Generation
Create a function to generate the detailed sandpiper mascot with depth and shading:
```typescript
function getSandpiperMascot(theme: Theme): string[] {
  // Generate detailed mascot using block characters and multiple theme colors
  // Similar complexity to Pi mascot/Copilot logo examples
}
```

### 4.2 Information Formatting
Implement functions to format each type of information:
- Format keybinding hints with consistent styling
- Format resource listings with counts and source information
- Format model information

### 4.3 Layout Management
- Calculate proper widths for each column
- Handle text trunc within columns
- Ensure lines don't exceed width limits

## 5. Extension Integration

The extension will need to:
1. Register the custom header on session start
2. Provide a command to restore the built-in header
3. Handle theme changes properly