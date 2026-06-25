# Animation Cookbook

Two primitives, no animation library:

1. **View Transitions API** (`document.startViewTransition`) for *between-page* animation,
   including Flutter-style hero / shared-element morphs.
2. **Vue's `<Transition>` / `<TransitionGroup>`** for *within-page* enter/leave (modals, lists,
   toasts).

Page navigation is wrapped once in `src/router/index.ts`. **Never call
`document.startViewTransition` anywhere else.** Pages opt into effects purely via CSS in
`src/assets/css/transitions.css`.

---

## 1. Add a hero transition between two pages

The shared-element ("Hero") recipe — three steps:

1. On the **source** element (e.g. an incident card block), set an inline dynamic name:
   `:style="{ viewTransitionName: 'incident-' + incident.id }"`.
2. On the **target** element (the matching header block on the detail page), set the **same**
   name: `:style="{ viewTransitionName: 'incident-' + incident.id }"`.
3. That's it. The browser matches the two names across the navigation and morphs
   position/size/shape automatically.

**Critical rule:** a `view-transition-name` must be unique per page at any moment. **Never put a
static name in a `v-for`** — always derive it from the item id. Reference implementation:
`IncidentCard.vue` → `IncidentDetailPage.vue` (block + title both morph).

## 2. Add a custom per-page transition

Worked example — slide the About page in:

```css
/* transitions.css */
::view-transition-old(about-page) { animation: 220ms ease both fade-out; }
::view-transition-new(about-page) { animation: 220ms ease both slide-in-right; }

@keyframes slide-in-right { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes fade-out       { to   { opacity: 0 } }
```

```vue
<!-- AboutPage.vue root element -->
<section style="view-transition-name: about-page"> … </section>
```

## 3. Animate a list reorder / insert / remove

Use `<TransitionGroup>` with the Recipe 4 classes already defined in `transitions.css`:

```vue
<TransitionGroup name="list" tag="div" class="grid">
  <IncidentCard v-for="i in incidents" :key="i.id" :incident="i" />
</TransitionGroup>
```

`.list-move` gives the FLIP move animation; `.list-enter-*` / `.list-leave-*` handle insert and
remove. The home grid's "shuffle" button demonstrates this.

## 4. The rules

- Animate **only** `transform` and `opacity` (compositor-friendly).
- Durations **200–350ms**, easing `cubic-bezier(0.4, 0, 0.2, 1)`.
- `view-transition-name` values must be **unique per page** at any moment.
- Always test with **reduced motion** on (it must still be usable — it degrades to instant).
- **Never nest** `startViewTransition` calls.

## 5. Platform support

View Transitions: Chromium (incl. Android WebView) since 111, iOS WKWebView since iOS 18. On
anything older the router wrapper silently degrades to instant navigation — that's the designed
fallback, not a bug.
