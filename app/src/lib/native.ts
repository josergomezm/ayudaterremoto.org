import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Device } from '@capacitor/device'
import type { Router } from 'vue-router'
import { i18n, hasStoredLocale, SUPPORTED_LOCALES, type Locale } from '../i18n'

/**
 * Wire up native behaviors that have no browser equivalent. Called once from main.ts.
 *
 * Android back button: without this, the hardware/gesture back button closes the
 * app from ANY page instead of navigating back. We route it through vue-router and
 * only exit the app when there's nowhere left to go back to.
 */
export function registerNative(router: Router) {
  if (!Capacitor.isNativePlatform()) return // no-op in the browser

  App.addListener('backButton', () => {
    if (window.history.state?.back) {
      router.back()
    } else {
      App.exitApp()
    }
  })
}

/**
 * Follow the device's system language on native platforms. The web build already
 * picks up the device language via navigator.language at startup (see i18n/index.ts);
 * this uses the authoritative Capacitor Device API on iOS/Android. We do NOT
 * persist this — an explicit choice in LocaleSwitcher always wins and is remembered.
 */
export async function applyDeviceLocale(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (hasStoredLocale()) return // user picked a language explicitly — respect it
  try {
    const { value } = await Device.getLanguageCode()
    const base = value?.split('-')[0]
    if (base && (SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      i18n.global.locale.value = base as Locale
    }
  } catch { /* keep the navigator-detected default */ }
}
