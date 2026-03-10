# Sandpiper Custom Header - Design Review Checklist

## 1. Header Information Elements
- [x] Identify all potential header elements from Pi's built-in header
- [x] Categorize elements by priority (High/Medium/Low)
- [x] Determine which elements to consolidate
- High Priority: App identity, essential/common keybindings, model info, resource listings
- Low Priority: Git branch status (omit)

## 2. Mascot Design
- [x] Select reference sandpiper image for inspiration: Non-breeding adult picking at mollusk/shellfish
- [x] Determine preferred style: Highly detailed with depth and shading, profile view
- [x] Establish size constraints: As detailed as feasible within header space (5-8 lines)
- [x] Choose character set approach: Extensive use of block characters and colors for depth/shading
- [x] Style reference: Similar to Pi mascot/Copilot logo complexity
- [x] Fully specified in requirements document with RFC2119 conventions

## 3. Layout Approach
- [x] Finalize horizontal space utilization strategy: Two-column layout with table aesthetic
- [x] Decide between tabular or multi-column layout: Hybrid approach with logo/app identity/model in left cell, keybindings/resources in right cell
- [x] Determine responsive behavior for different terminal widths: Right column wider (30/70 distribution)
- [x] Plan information density vs readability balance: Moderate spacing for better readability
- [x] Border/Divider Style: Claude Code style dividers

## 4. Vertical Space Reduction
- [x] Set target vertical height: 20-30 lines
- [x] Identify keybinding triage strategy: Essential + common keybindings
- [x] Optimize resource listing presentation: Count-based with abbreviated source info
- [x] Consider interactive elements (expand/collapse): Not required for MVP

## 5. Implementation Planning
- [x] Review TUI API capabilities: Custom component with render() and invalidate() methods
- [x] Plan component structure: Single custom component implementing Component interface
- [x] Identify data sources for dynamic information: ExtensionAPI context, session manager, resource loader
- [x] Consider theme compatibility: Use theme functions for all styling
- [x] Border/Divider options: DynamicBorder component available for Claude Code style dividers

## 6. Requirements Documentation
- [x] Document detailed requirements with RFC2119 conventions
- [x] Specify information prioritization
- [x] Define layout constraints
- [x] Establish performance and compatibility requirements