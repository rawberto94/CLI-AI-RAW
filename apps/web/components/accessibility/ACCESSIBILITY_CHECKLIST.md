# WCAG 2.1 Level AA Accessibility Checklist

## Overview
This checklist ensures compliance with WCAG 2.1 Level AA standards for the Contract Intelligence Platform.

## 1. Perceivable

### 1.1 Text Alternatives
- [ ] All images have appropriate alt text
- [ ] Decorative images use empty alt attributes (alt="")
- [ ] Complex images have detailed descriptions
- [ ] Icons have accessible labels or are marked as decorative

### 1.2 Time-based Media
- [ ] Video content has captions
- [ ] Audio content has transcripts
- [ ] Live audio has captions

### 1.3 Adaptable
- [ ] Content structure uses semantic HTML
- [ ] Heading hierarchy is logical (h1, h2, h3, etc.)
- [ ] Lists use proper list markup
- [ ] Tables have proper headers and captions
- [ ] Form inputs have associated labels
- [ ] Reading order is logical

### 1.4 Distinguishable
- [ ] Color is not the only means of conveying information
- [ ] Text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] Images of text are avoided (except logos)
- [ ] Audio controls are available
- [ ] Focus indicators are visible

## 2. Operable

### 2.1 Keyboard Accessible
- [ ] All functionality is available via keyboard
- [ ] No keyboard traps exist
- [ ] Keyboard shortcuts don't conflict with assistive technology
- [ ] Focus order is logical
- [ ] Skip links are provided

### 2.2 Enough Time
- [ ] Time limits can be extended or disabled
- [ ] Auto-updating content can be paused
- [ ] Session timeouts have warnings

### 2.3 Seizures and Physical Reactions
- [ ] No content flashes more than 3 times per second
- [ ] Animation can be disabled (respects prefers-reduced-motion)

### 2.4 Navigable
- [ ] Page titles are descriptive
- [ ] Focus order is meaningful
- [ ] Link purpose is clear from context
- [ ] Multiple ways to find pages (navigation, search, sitemap)
- [ ] Headings and labels are descriptive
- [ ] Focus is visible

### 2.5 Input Modalities
- [ ] Touch targets are at least 44x44 pixels
- [ ] Pointer gestures have keyboard alternatives
- [ ] Accidental activation is prevented

## 3. Understandable

### 3.1 Readable
- [ ] Page language is identified (lang attribute)
- [ ] Language changes are marked
- [ ] Unusual words are defined
- [ ] Abbreviations are explained

### 3.2 Predictable
- [ ] Focus doesn't cause unexpected context changes
- [ ] Input doesn't cause unexpected context changes
- [ ] Navigation is consistent across pages
- [ ] Components are identified consistently

### 3.3 Input Assistance
- [ ] Form errors are identified and described
- [ ] Labels and instructions are provided
- [ ] Error suggestions are provided
- [ ] Error prevention for important actions (confirmation)
- [ ] Help is available

## 4. Robust

### 4.1 Compatible
- [ ] HTML is valid
- [ ] ARIA roles and attributes are used correctly
- [ ] Status messages use appropriate ARIA live regions
- [ ] Custom components have proper ARIA attributes

## Component-Specific Checks

### Buttons
- [ ] Have accessible names
- [ ] Indicate state (aria-pressed, aria-expanded)
- [ ] Are keyboard accessible
- [ ] Have visible focus indicators

### Forms
- [ ] All inputs have labels
- [ ] Required fields are indicated
- [ ] Error messages are associated with inputs
- [ ] Fieldsets group related inputs
- [ ] Help text is available

### Modals/Dialogs
- [ ] Focus is trapped within modal
- [ ] Focus returns to trigger on close
- [ ] Escape key closes modal
- [ ] Proper ARIA attributes (role="dialog", aria-modal)
- [ ] Title is announced to screen readers

### Tables
- [ ] Have captions or aria-label
- [ ] Use th elements for headers
- [ ] Complex tables use scope or headers/id

### Navigation
- [ ] Uses nav element or role="navigation"
- [ ] Current page is indicated
- [ ] Keyboard accessible
- [ ] Skip links provided

### Images
- [ ] Informative images have descriptive alt text
- [ ] Decorative images have empty alt
- [ ] Complex images have long descriptions

## Testing Methods

### Automated Testing
- [ ] Run axe DevTools
- [ ] Run WAVE browser extension
- [ ] Run Lighthouse accessibility audit
- [ ] Validate HTML

### Manual Testing
- [ ] Test with keyboard only (no mouse)
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Test with browser zoom at 200%
- [ ] Test with high contrast mode
- [ ] Test with reduced motion enabled
- [ ] Test color contrast with tools

### Screen Reader Testing
- [ ] All content is announced
- [ ] Navigation is logical
- [ ] Form labels are read correctly
- [ ] Error messages are announced
- [ ] Dynamic content updates are announced

## Common Issues to Avoid

1. **Missing alt text on images**
2. **Insufficient color contrast**
3. **Missing form labels**
4. **Keyboard traps**
5. **Missing focus indicators**
6. **Improper heading hierarchy**
7. **Using div/span instead of semantic HTML**
8. **Missing ARIA labels on icon buttons**
9. **Not announcing dynamic content changes**
10. **Inaccessible custom components**

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)

## Sign-off

- [ ] Automated tests pass
- [ ] Manual keyboard testing complete
- [ ] Screen reader testing complete
- [ ] Color contrast verified
- [ ] Documentation updated
- [ ] Team trained on accessibility

---

**Last Updated:** [Date]
**Reviewed By:** [Name]
**Next Review:** [Date]
