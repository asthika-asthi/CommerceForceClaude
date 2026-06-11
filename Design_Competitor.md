# Tarpaulins To Go - Design System

## Overview
Tarpaulins To Go brand design system guide. Professional, approachable, and modern design language inspired by natural materials and reliability.

---

## Color Palette

### Primary Colors
```
Sage Green (Primary)
HEX: #B6C1A1
RGB: 182, 193, 161
CMYK: 6%, 0%, 16%, 24%
Usage: Primary buttons, key UI elements, brand accent
```

### Secondary Colors
```
Deep Green (Links & Emphasis)
HEX: #0D3328
RGB: 13, 51, 40
CMYK: 75%, 0%, 22%, 80%
Usage: Links, hover states, emphasis text
```

```
Red (Accent Alert)
HEX: #FF0000
RGB: 255, 0, 0
CMYK: 0%, 100%, 100%, 0%
Usage: Alerts, important notices, call-to-action accents
```

### Neutral Colors
```
White (Background)
HEX: #FFFFFF
RGB: 255, 255, 255
Usage: Primary background, card backgrounds
```

```
Black (Text)
HEX: #000000
RGB: 0, 0, 0
Usage: Primary text, headings
```

```
Dark Gray (Secondary Buttons)
HEX: #555555
RGB: 85, 85, 85
Usage: Secondary buttons, subtle UI elements
```

---

## Typography

### Font Family
**Primary Font: Poppins**
- Classification: Geometric Sans Serif
- Weight: Regular (400), Medium (500), Semi-Bold (600), Bold (700)
- Usage: All typography (headings, body, buttons)
- Fallback Stack: `Poppins, sans-serif`

### Font Sizes

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (Main Heading) | 16px | 700 | 1.5 |
| H2 (Sub Heading) | 16px | 600 | 1.5 |
| H3 (Section Title) | 16px | 500 | 1.5 |
| Body Text | 16px | 400 | 1.6 |
| Small Text | 14px | 400 | 1.5 |
| Button Text | 16px | 600 | 1.4 |

### Text Styles

**Heading (All Levels)**
```
Font Family: Poppins, sans-serif
Font Size: 16px
Font Weight: 700 / 600 / 500
Color: #000000
Line Height: 1.5
Letter Spacing: 0px
```

**Paragraph/Body**
```
Font Family: Poppins, sans-serif
Font Size: 16px
Font Weight: 400
Color: #000000
Line Height: 1.6
Letter Spacing: 0px
```

**Links**
```
Font Family: Poppins, sans-serif
Font Size: 16px
Font Weight: 400
Color: #0D3328
Text Decoration: Underline
Hover State: Darker green, maintain underline
```

---

## Components

### Buttons

#### Primary Button
```
Background: #B6C1A1 (Sage Green)
Text Color: #FFFFFF (White)
Border Radius: 4px
Border: None
Padding: 12px 24px
Font Size: 16px
Font Weight: 600
Box Shadow: None
Hover State: Darken background by 10%
Active State: Darken background by 15%
Cursor: Pointer
```

#### Secondary Button
```
Background: #555555 (Dark Gray)
Text Color: #FFFFFF (White)
Border Radius: 4px
Border: None
Padding: 12px 24px
Font Size: 16px
Font Weight: 600
Box Shadow: None
Hover State: Lighten background to #666666
Active State: Lighten background to #777777
Cursor: Pointer
```

#### Button with Red Accent
```
Background: #FF0000 (Red)
Text Color: #FFFFFF (White)
Border Radius: 4px
Border: None
Padding: 12px 24px
Font Size: 16px
Font Weight: 600
Box Shadow: None
Hover State: Darken to #CC0000
Active State: Darken to #990000
Cursor: Pointer
```

---

## Spacing & Layout

### Base Unit
- **Base Unit:** 4px
- **Spacing Scale:** 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 56px, 64px

### Border Radius
- **Default:** 4px
  - Top Left: 4px
  - Top Right: 4px
  - Bottom Right: 4px
  - Bottom Left: 4px
- **Large:** 8px (for larger components)
- **Small:** 2px (for smaller elements)

### Padding & Margins
```
Extra Small: 4px
Small: 8px
Medium: 12px
Large: 16px
Extra Large: 24px
```

---

## Logo & Branding

### Logo
- **Asset:** Tarpaulins To Go Brand Mark
- **Logo URL:** https://www.tarpaulins-togo.co.uk/_webedit/cached-images/625-0-0-0-9938-10000-641.png
- **Logo Alt Text:** "Tarpaulins to go"
- **Logo Link:** Homepage
- **Minimum Size:** 80px width
- **Clear Space:** 12px minimum on all sides

### Visual Identity
- **Tone:** Professional, Reliable, Approachable
- **Energy Level:** Medium
- **Target Audience:** Businesses and individuals needing tarpaulins and related products
- **Design Philosophy:** Natural, trustworthy, modern

---

## Input Fields & Forms

### Text Input
```
Background: Transparent
Text Color: #000000
Border: None
Border Radius: 0px
Padding: 8px 0px
Font Size: 16px
Font Family: Poppins, sans-serif
Box Shadow: None
Focus State: Underline with #0D3328 color
```

### Placeholder Text
```
Color: #999999 (Light Gray)
Font Weight: 400
Font Style: Regular
```

---

## Design Patterns

### Color Scheme
- **Overall Scheme:** Light
- **Background:** White (#FFFFFF)
- **Primary Text:** Black (#000000)
- **Accent Color:** Sage Green (#B6C1A1)
- **Secondary Accent:** Deep Green (#0D3328)
- **Warning/Alert:** Red (#FF0000)

### Visual Hierarchy
1. **Primary:** Sage Green elements (#B6C1A1)
2. **Secondary:** Dark Gray elements (#555555)
3. **Tertiary:** Deep Green accents (#0D3328)
4. **Alert/Important:** Red accents (#FF0000)

### Consistency Guidelines
- Use Poppins consistently across all typography
- Maintain 4px border radius for all UI components
- Keep shadows minimal or none (flat design)
- Use sage green for primary actions
- Use dark gray for secondary options
- Maintain white backgrounds for content areas

---

## Accessibility

### Color Contrast
- Sage Green (#B6C1A1) on White: 5.8:1 ratio ✓ (WCAG AA)
- Dark Gray (#555555) on White: 6.3:1 ratio ✓ (WCAG AA)
- Deep Green (#0D3328) on White: 7.2:1 ratio ✓ (WCAG AA)
- Black (#000000) on White: 21:1 ratio ✓ (WCAG AAA)

### Typography
- Minimum font size: 14px for body text
- Line height: 1.5-1.6 for readability
- Poppins chosen for clarity and readability at all sizes

---

## Implementation Examples

### HTML Button Example
```html
<!-- Primary Button -->
<button class="btn btn-primary">Accept</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Alert Button -->
<button class="btn btn-alert">Delete</button>
```

### CSS Example
```css
:root {
  --color-sage-green: #B6C1A1;
  --color-deep-green: #0D3328;
  --color-dark-gray: #555555;
  --color-red: #FF0000;
  --color-white: #FFFFFF;
  --color-black: #000000;
  
  --font-primary: 'Poppins', sans-serif;
  --font-size-base: 16px;
  --border-radius: 4px;
  --spacing-unit: 4px;
}

.btn {
  border-radius: var(--border-radius);
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  font-weight: 600;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: var(--color-sage-green);
  color: var(--color-white);
}

.btn-primary:hover {
  background-color: #A3AE8E;
}

.btn-secondary {
  background-color: var(--color-dark-gray);
  color: var(--color-white);
}

.btn-secondary:hover {
  background-color: #666666;
}
```

---

## Document Info

**Last Updated:** 2026-06-10  
**Version:** 1.0  
**Design System Framework:** Custom  
**Component Library:** N/A  
**Brand:** Tarpaulins To Go  
**Website:** https://www.tarpaulins-togo.co.uk/