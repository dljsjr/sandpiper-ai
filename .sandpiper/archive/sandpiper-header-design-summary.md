# Sandpiper Custom Header Design Summary

## Overview
This document summarizes the design decisions for the custom Sandpiper header extension that will replace the built-in Pi header with a more compact, information-dense header combining traditional header elements with resource listings.

## Key Design Decisions

### 1. Information Prioritization
- **High Priority**: App identity, essential/common keybindings, model info, resource listings
- **Low Priority**: Git branch status (to be omitted)

### 2. Layout Approach
- **Structure**: Two-column layout with table aesthetic
- **Distribution**: Left column 30%, Right column 70%
- **Organization**: 
  - Left cell: Mascot, app identity, model info
  - Right cells: Keybindings and resources in vertical stack
- **Spacing**: Moderate spacing for readability
- **Borders**: Claude Code style dividers using DynamicBorder

### 3. Visual Design
- **Mascot**: Highly detailed sandpiper with depth and shading, 6-8 lines tall
- **Character Set**: Extensive block characters with liberal coloring for depth
- **Inspiration**: Non-breeding adult sandpiper reference image, Pi mascot/Copilot logo style

### 4. Space Management
- **Vertical**: Target 20-30 lines (increased from initial estimate)
- **Horizontal**: Full utilization with two-column approach
- **Density**: Balanced information density with good readability

### 5. Technical Implementation
- **Component**: Custom TUI Component implementing render() and invalidate()
- **Data Sources**: ExtensionAPI context, session manager, resource loader
- **Theming**: Full theme compatibility using theme functions
- **Performance**: Cached rendering with proper invalidation

## Requirements Coverage