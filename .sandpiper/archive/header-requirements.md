# Sandpiper Custom Header Requirements

## 1. Overview

The Sandpiper custom header extension MUST replace the built-in Pi header with a compact, information-dense header that combines traditional header elements with resource listing information. The header MUST utilize horizontal space efficiently while minimizing vertical footprint.

## 2. Information Requirements

### 2.1 App Identity
The header MUST display the application name and version information. This information MUST be prominently visible and SHOULD use accent coloring to distinguish it from other elements.

### 2.2 Keybinding Information
The header MUST include essential keybinding hints and SHOULD include common keybinding hints. The keybinding information:
- MUST include: Submit message, Clear editor, Exit application, Interrupt operation
- SHOULD include: Cycle model, Select model, External editor
- MAY include: Additional keybindings if space permits
- MUST be condensed to minimize vertical space usage

### 2.3 Model Information
The header MUST display the currently active model information including provider and model identifier. This information MUST be updated dynamically when the model changes.

### 2.4 Resource Listings
The header MUST incorporate resource listing information that would normally appear in the chat container:
- Context files (if any are loaded)
- Skills (count and source information)
- Prompts (count and source information)
- Extensions (count and source information)
- Themes (count of custom themes)

Each resource category MUST display a count of items and MAY display abbreviated source information. The resource listings MUST be formatted to fit within the horizontal space constraints.

## 3. Layout Requirements

### 3.1 Vertical Space
The header MUST occupy no more than 30 lines of vertical space under normal conditions. The header SHOULD aim for 20-25 lines when possible. The header MAY expand to 30 lines to accommodate all required information while maintaining readability.

### 3.2 Horizontal Utilization
The header MUST utilize available horizontal space effectively through a two-column layout with table aesthetic:
- The left column MUST contain the mascot, app identity, and model information in a single cell
- The right column MUST contain keybinding hints and resource listings in vertically stacked cells
- The left column MUST occupy approximately 30% of horizontal space with the right column occupying 70%
- Cells MUST be separated by horizontal dividers consistent with the Claude Code aesthetic
- The layout MUST maintain moderate spacing for better readability
- The layout MUST maintain readability

### 3.3 Responsive Design
The header MUST adapt to different terminal widths:
- For terminals narrower than 80 columns, the header SHOULD prioritize vertical stacking with critical information
- For terminals 80+ columns, the header MUST use horizontal distribution of information
- For terminals wider than 120 columns, the header MAY display additional detailed information

## 4. Visual Design Requirements

### 4.1 Mascot Integration
The header MUST include a highly detailed sandpiper mascot with depth and shading. The mascot:
- MUST depict a sandpiper in profile view, appearing to pick at something with its beak
- MUST be inspired by the non-breeding adult sandpiper reference image
- MUST use extensive block characters and liberal coloring to emulate depth and shading
- MUST be similar in complexity to the Pi mascot or Copilot logo examples
- SHOULD be sized appropriately to fit within the overall header design (5-8 lines maximum)
- MUST be positioned to optimize the overall header layout
- SHOULD use theme-appropriate coloring for visual integration while maintaining detailed appearance

### 4.2 Information Hierarchy
The header MUST establish clear visual hierarchy:
- App identity MUST be most prominent
- Essential keybindings SHOULD be clearly distinguished
- Resource listings MAY use muted coloring
- Keybinding hints SHOULD use consistent formatting

### 4.3 Theme Compatibility
The header MUST respect the current theme colors and styling. All text elements MUST use appropriate theme functions for foreground and background coloring. The header MUST respond to theme changes appropriately.

## 5. Technical Requirements

### 5.1 Performance
The header component:
- MUST render efficiently with minimal performance impact
- SHOULD cache rendered output when possible
- MUST properly implement the invalidate() method for theme changes

### 5.2 Data Sources
The header MUST obtain information from the following sources:
- ExtensionAPI context for app identity and version
- Session manager for model information
- Resource loader for resource listing information
- Theme provider for styling information

### 5.3 TUI Compliance
The header component MUST comply with TUI component interface requirements:
- render() method MUST respect width parameter
- invalidate() method MUST properly clear caches
- Component MUST not exceed allocated width

## 6. Implementation Constraints

### 6.1 Extension Integration
The header MUST be implemented as a Pi extension that:
- Uses ctx.ui.setHeader() to replace the built-in header
- Provides a command to restore the built-in header
- Integrates with the existing extension system

### 6.2 Backward Compatibility
The implementation MUST maintain backward compatibility by:
- Providing a way to restore the original header
- Not breaking existing functionality
- Following established extension patterns

## 7. Quality Requirements

### 7.1 Reliability
The header MUST handle error conditions gracefully:
- Missing resource information SHOULD be handled without crashing
- Theme changes MUST be processed without visual artifacts
- Dynamic updates MUST not cause flickering or inconsistent display

### 7.2 Maintainability
The implementation SHOULD follow established patterns from Pi examples and:
- Use clear, well-commented code
- Separate concerns appropriately
- Follow TypeScript best practices