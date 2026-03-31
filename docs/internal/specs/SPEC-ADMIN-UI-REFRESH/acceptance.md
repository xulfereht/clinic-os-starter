# Acceptance Criteria - SPEC-ADMIN-UI-REFRESH

## Functionality Preservation Tests

### Dashboard (`/admin/`)

- [ ] KPI cards display correct real-time data
- [ ] Recent activity feed loads and updates
- [ ] Navigation to other pages works
- [ ] Demo mode blur still functions
- [ ] Notification polling continues working

### Patients (`/admin/patients/`)

- [ ] Patient list loads with pagination
- [ ] Search functionality works
- [ ] Filter by status works
- [ ] Patient detail page loads correctly
- [ ] Edit patient functionality preserved
- [ ] Delete patient (soft delete) works

### Leads (`/admin/leads/`)

- [ ] Lead list loads correctly
- [ ] Lead status updates work
- [ ] Link to patient functionality preserved
- [ ] Lead detail page loads
- [ ] Tags management works

### Payments (`/admin/payments/`)

- [ ] Payment list displays correctly
- [ ] Payment filtering works
- [ ] Payment detail modal functions

### Reservations (`/admin/reservations/`)

- [ ] Calendar view renders
- [ ] Reservation creation works
- [ ] Status updates function
- [ ] Time slot selection works

### Settings (`/admin/settings/`)

- [ ] All settings pages load
- [ ] Form submissions save correctly
- [ ] Tab navigation works
- [ ] Validation messages display

---

## Design System Compliance Tests

### Tokens

- [ ] All colors use `--ds-*` variables
- [ ] Spacing follows token scale
- [ ] Border radius matches design
- [ ] Typography is consistent

### Components

- [ ] DSButton renders all variants correctly
- [ ] DSInput handles all states (focus, error, disabled)
- [ ] DSCard displays header and body correctly
- [ ] DSBadge shows all color variants
- [ ] DSTableRow aligns columns properly
- [ ] DSPageHeader displays title, description, actions

---

## Performance Tests

- [ ] Initial page load < 3 seconds
- [ ] No layout shift (CLS < 0.1)
- [ ] No memory leaks from new components
- [ ] Bundle size increase < 10KB

---

## Cross-Browser Tests

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Mobile Responsive Tests

- [ ] Sidebar collapses on mobile
- [ ] Tables scroll horizontally
- [ ] Forms are usable on touch
- [ ] Modals are fullscreen on mobile

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | Pending |
| QA | | | Pending |
| Product Owner | | | Pending |
