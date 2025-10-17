import type { Directive, DirectiveBinding } from 'vue'

interface HTMLElementWithClickOutside extends HTMLElement {
  __ClickOutsideHandler__: (event: Event) => void
}

const clickOutside: Directive = {
  mounted(el: HTMLElementWithClickOutside, binding: DirectiveBinding) {
    el.__ClickOutsideHandler__ = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value(event)
      }
    }
    document.body.addEventListener('click', el.__ClickOutsideHandler__)
  },
  unmounted(el: HTMLElementWithClickOutside) {
    document.body.removeEventListener('click', el.__ClickOutsideHandler__)
  }
}

export default clickOutside