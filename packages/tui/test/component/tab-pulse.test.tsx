/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import {
  TabPulse,
  blendTabPulseColor,
  completionPulseOpacity,
  glowIgnitionLevel,
  unreadGlowIntensity,
} from "../../src/component/tab-pulse"
import { tint } from "../../src/theme/color"

test("a prompt pulse restarts the neutral edge flash while the tab remains busy", async () => {
  const background = RGBA.fromHex("#101010")
  const flash = RGBA.fromHex("#f0f0f0")
  const [promptPulse, setPromptPulse] = createSignal(0)
  const app = await testRender(
    () => (
      <box width={8} height={1} backgroundColor={background}>
        <TabPulse
          layer={{
            active: true,
            promptPulse: promptPulse(),
            color: background,
            flashColor: flash,
          }}
          backgroundColor={background}
        />
      </box>
    ),
    { width: 8, height: 1 },
  )

  const firstBackground = () => app.captureSpans().lines[0]?.spans[0]?.bg

  try {
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeTrue()

    setPromptPulse(1)
    await Bun.sleep(80)
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeFalse()
    expect(firstBackground()?.r ?? 0).toBeGreaterThan(0.17)

    await Bun.sleep(800)
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeTrue()

    setPromptPulse(2)
    await Bun.sleep(80)
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeFalse()
  } finally {
    app.renderer.destroy()
  }
})

test("edge layers animate independently", async () => {
  const background = RGBA.fromHex("#101010")
  const lower = RGBA.fromHex("#ff0000")
  const upper = RGBA.fromHex("#0000ff")
  const [edgeGlow, setEdgeGlow] = createSignal(false)
  const app = await testRender(
    () => (
      <box width={8} height={1} backgroundColor={background}>
        <TabPulse
          edge="above"
          layer={{ color: background, glow: true, glowColor: lower }}
          edgeLayer={{ color: background, glow: edgeGlow(), glowColor: upper }}
          backgroundColor={background}
        />
      </box>
    ),
    { width: 8, height: 1 },
  )

  try {
    await app.renderOnce()
    const initial = app.captureSpans().lines[0]?.spans[0]
    expect(initial?.text.startsWith("▄")).toBeTrue()
    expect(initial?.fg.r ?? 0).toBeGreaterThan(initial?.fg.b ?? 0)
    expect(initial?.bg.equals(background)).toBeTrue()

    setEdgeGlow(true)
    await Bun.sleep(80)
    await app.renderOnce()
    const updated = app.captureSpans().lines[0]?.spans[0]
    expect(updated?.fg.r ?? 0).toBeGreaterThan(updated?.fg.b ?? 0)
    expect(updated?.bg.b ?? 0).toBeGreaterThan(updated?.bg.r ?? 0)
  } finally {
    app.renderer.destroy()
  }
})

test("an atomic active-to-complete layer update starts the completion pulse", async () => {
  const background = RGBA.fromHex("#101010")
  const completion = RGBA.fromHex("#f0f0f0")
  const [state, setState] = createSignal({ active: true, complete: false })
  const app = await testRender(
    () => (
      <box width={8} height={1} backgroundColor={background}>
        <TabPulse
          layer={{
            ...state(),
            color: background,
            completionColor: completion,
          }}
          backgroundColor={background}
        />
      </box>
    ),
    { width: 8, height: 1 },
  )

  const firstBackground = () => app.captureSpans().lines[0]?.spans[0]?.bg

  try {
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeTrue()

    setState({ active: false, complete: true })
    await Bun.sleep(80)
    await app.renderOnce()
    expect(firstBackground()?.equals(background)).toBeFalse()
  } finally {
    app.renderer.destroy()
  }
})

test("completion pulse rises quickly and fades over the remaining duration", () => {
  expect(completionPulseOpacity(0)).toBe(0)
  expect(completionPulseOpacity(0.06)).toBeCloseTo(0.5)
  expect(completionPulseOpacity(0.12)).toBe(1)
  expect(completionPulseOpacity(0.56)).toBeCloseTo(0.5)
  expect(completionPulseOpacity(1)).toBe(0)
})

test("glow ignition overshoots the resting level and settles back to it", () => {
  expect(glowIgnitionLevel(0)).toBe(0)
  expect(glowIgnitionLevel(0.3)).toBeCloseTo(1.5)
  expect(glowIgnitionLevel(0.6)).toBeGreaterThan(1)
  expect(glowIgnitionLevel(1)).toBe(1)
})

test("unread glow peaks behind the tab number and fades to the normal background", () => {
  const intensities = Array.from({ length: 22 }, (_, index) => unreadGlowIntensity(index, 22))

  expect(intensities[0]).toBe(1)
  expect(intensities[1]).toBe(1)
  expect(intensities[2]).toBeLessThan(1)
  expect(intensities.slice(1)).toEqual(intensities.slice(1).sort((a, b) => b - a))
  expect(intensities[13]).toBe(0)
  expect(intensities.at(-1)).toBe(0)
})

test("unread glow reaches the normal background on compact tabs", () => {
  expect(unreadGlowIntensity(0, 8)).toBe(1)
  expect(unreadGlowIntensity(7, 8)).toBe(0)
})

test("reuses a color while preserving the original glow and pulse blend stages", () => {
  const output = RGBA.fromInts(0, 0, 0)
  const background = RGBA.fromHex("#1a1b26")
  const glowColor = RGBA.fromHex("#82aaff")
  const runningColor = RGBA.fromHex("#c8d3f5")
  const flashColor = RGBA.fromHex("#e2e8fb")
  const completionColor = RGBA.fromHex("#ff9e64")

  for (const glow of [0, 0.08, 0.16]) {
    for (const running of [0, 0.01, 0.07, 0.14]) {
      for (const flash of [0, 0.05, 0.1]) {
        for (const completion of [0, 0.03, 0.09, 0.18]) {
          blendTabPulseColor(
            output,
            background,
            glowColor,
            runningColor,
            flashColor,
            completionColor,
            glow,
            running,
            flash,
            completion,
          )
          expect(output.buffer).toEqual(
            tint(
              tint(tint(tint(background, glowColor, glow), runningColor, running), flashColor, flash),
              completionColor,
              completion,
            ).buffer,
          )
        }
      }
    }
  }
})
