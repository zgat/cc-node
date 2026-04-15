import { createElement, type ReactNode } from 'react'
import { ThemeProvider } from './components/design-system/ThemeProvider.tsx'
import inkRender, {
  type Instance,
  createRoot as inkCreateRoot,
  type RenderOptions,
  type Root,
} from './ink/root.ts'

export type { RenderOptions, Instance, Root }

// Wrap all CC render calls with ThemeProvider so ThemedBox/ThemedText work
// without every call site having to mount it. Ink itself is theme-agnostic.
function withTheme(node: ReactNode): ReactNode {
  return createElement(ThemeProvider, null, node)
}

export async function render(
  node: ReactNode,
  options?: NodeJS.WriteStream | RenderOptions,
): Promise<Instance> {
  return inkRender(withTheme(node), options)
}

export async function createRoot(options?: RenderOptions): Promise<Root> {
  const root = await inkCreateRoot(options)
  return {
    ...root,
    render: node => root.render(withTheme(node)),
  }
}

export { color } from './components/design-system/color.ts'
export type { Props as BoxProps } from './components/design-system/ThemedBox.tsx'
export { default as Box } from './components/design-system/ThemedBox.tsx'
export type { Props as TextProps } from './components/design-system/ThemedText.tsx'
export { default as Text } from './components/design-system/ThemedText.tsx'
export {
  ThemeProvider,
  usePreviewTheme,
  useTheme,
  useThemeSetting,
} from './components/design-system/ThemeProvider.tsx'
export { Ansi } from './ink/Ansi.tsx'
export type { Props as AppProps } from './ink/components/AppContext.ts'
export type { Props as BaseBoxProps } from './ink/components/Box.tsx'
export { default as BaseBox } from './ink/components/Box.tsx'
export type {
  ButtonState,
  Props as ButtonProps,
} from './ink/components/Button.tsx'
export { default as Button } from './ink/components/Button.tsx'
export type { Props as LinkProps } from './ink/components/Link.tsx'
export { default as Link } from './ink/components/Link.tsx'
export type { Props as NewlineProps } from './ink/components/Newline.tsx'
export { default as Newline } from './ink/components/Newline.tsx'
export { NoSelect } from './ink/components/NoSelect.tsx'
export { RawAnsi } from './ink/components/RawAnsi.tsx'
export { default as Spacer } from './ink/components/Spacer.tsx'
export type { Props as StdinProps } from './ink/components/StdinContext.ts'
export type { Props as BaseTextProps } from './ink/components/Text.tsx'
export { default as BaseText } from './ink/components/Text.tsx'
export type { DOMElement } from './ink/dom.ts'
export { ClickEvent } from './ink/events/click-event.ts'
export { EventEmitter } from './ink/events/emitter.ts'
export { Event } from './ink/events/event.ts'
export type { Key } from './ink/events/input-event.ts'
export { InputEvent } from './ink/events/input-event.ts'
export type { TerminalFocusEventType } from './ink/events/terminal-focus-event.ts'
export { TerminalFocusEvent } from './ink/events/terminal-focus-event.ts'
export { FocusManager } from './ink/focus.ts'
export type { FlickerReason } from './ink/frame.ts'
export { useAnimationFrame } from './ink/hooks/use-animation-frame.ts'
export { default as useApp } from './ink/hooks/use-app.ts'
export { default as useInput } from './ink/hooks/use-input.ts'
export { useAnimationTimer, useInterval } from './ink/hooks/use-interval.ts'
export { useSelection } from './ink/hooks/use-selection.ts'
export { default as useStdin } from './ink/hooks/use-stdin.ts'
export { useTabStatus } from './ink/hooks/use-tab-status.ts'
export { useTerminalFocus } from './ink/hooks/use-terminal-focus.ts'
export { useTerminalTitle } from './ink/hooks/use-terminal-title.ts'
export { useTerminalViewport } from './ink/hooks/use-terminal-viewport.ts'
export { default as measureElement } from './ink/measure-element.ts'
export { supportsTabStatus } from './ink/termio/osc.ts'
export { default as wrapText } from './ink/wrap-text.ts'
