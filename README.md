<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d0e12,55:1a1710,100:FFCC00&height=235&section=header&text=Tokyo%20Highway%20Dodge&fontSize=44&fontColor=FFF4CC&fontAlignY=40&desc=Make%20a%20fist%2C%20steer%20a%20car%2C%20dodge%20midnight%20traffic&descSize=17&descAlignY=62&animation=twinkling" alt="Tokyo Highway Dodge" width="100%">

<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=19&duration=3200&pause=900&color=FFCC00&center=true&vCenter=true&width=720&lines=A%20fist%20grabs%20the%20car%2C%20an%20open%20hand%20lets%20go;21%20landmarks%20a%20frame%2C%20smoothed%20before%20they%20reach%20the%20wheel;Four%20lanes%2C%20three%20lives%2C%20speed%20that%20never%20stops%20climbing" alt="Typing animation" />

<br />

<img src="https://img.shields.io/badge/Hand%20tracking-MediaPipe-FFCC00?style=flat-square&labelColor=0d0e12" alt="MediaPipe Hands" />
<img src="https://img.shields.io/badge/Gestures-2-FFB000?style=flat-square&labelColor=0d0e12" alt="Two gestures" />
<img src="https://img.shields.io/badge/Canvas-900%20%C3%97%201400-F0A500?style=flat-square&labelColor=0d0e12" alt="Canvas 900 by 1400" />
<img src="https://img.shields.io/badge/On%20device-inference-10b981?style=flat-square&labelColor=0d0e12" alt="On-device inference" />
<img src="https://img.shields.io/badge/Storage-localStorage-94a3b8?style=flat-square&labelColor=0d0e12" alt="localStorage" />
<img src="https://img.shields.io/badge/Language-en%20%2B%20zh-FFCC00?style=flat-square&labelColor=0d0e12" alt="English and Chinese" />

</div>

<br />

<div align="center">

<sub>One cam, no controller: the webcam becomes a steering wheel and the highway becomes a dodging game. Nothing is uploaded — the hand model runs in the tab and the scores never leave <code>localStorage</code>.</sub>

</div>

---

<div align="center">

## What it is

</div>

An arcade dodger on four lanes of a Tokyo expressway at night, driven by your hand instead of keys. The webcam feeds a landmark model that returns 21 points per frame; the horizontal position of the palm becomes the car's target lane, and the shape of your fingers decides whether the car obeys at all.

**Close a fist** and you have the wheel — the car tracks your hand left and right. **Open your hand** and the wheel is released, so the car keeps its line while you reposition. That single distinction is the whole control scheme: there is no mode switch, no on-screen joystick, and no key binding to remember.

Three lives, one run, and a speed floor that keeps rising until the traffic outruns the road. Coins, shields and swap tokens drop on the same lanes the cars do, which is exactly where the game wants you to be greedy.

<div align="center">

<sub>No camera, or a denied permission? The run still starts — a fist-less mode with the hand rail disabled, rather than a dead screen.</sub>

</div>

---

<div align="center">

## The two gestures

</div>

<ul>
<li><b>Fist → grip.</b> A finger counts as curled when its tip sits <i>below</i> its middle joint in image space (<code>tip.y &gt; pip.y</code>); three curled fingers out of four is a fist. While gripped, the car's target is the mirrored palm position, so your hand and the car move the same way a mirror does.</li>
<li><b>Open hand → release.</b> The target stops being rewritten. The car eases to the last target it was given and holds the lane, which is what lets you re-centre your hand without throwing the car across the road.</li>
</ul>

<div align="center">

<sub>Three of four, not four of four — a thumb sticking out of a fist is still a fist, and demanding all four costs you the gesture at the edge of the frame.</sub>

</div>

---

<div align="center">

## What is inside

</div>

<ul>
<li><b>Two-stage smoothing</b> — the raw palm x is mirrored (<code>1 - x</code>), pushed through an exponential filter at <code>0.18</code>, then converted to a pixel target clamped to <code>130…770</code> so the car cannot leave the asphalt. The car itself lerps toward that target at <code>0.1</code> per frame, so the motion has weight instead of teleporting.</li>
<li><b>A ramp, not a difficulty setting</b> — speed starts at <code>6.5</code>, gains <code>0.004</code> a frame, and caps at <code>18</code>. Obstacle spacing is derived from that same number (<code>max(36, 84 - speed × 1.5)</code> frames), so the road gets busier because you got faster, not because a timer said so.</li>
<li><b>Scoring that rewards nerve</b> — distance trickles in, passing a car pays <code>75 + combo × 12</code>, a near miss pays a combo step, and a coin is a flat <code>125</code>. Combo resets to zero the moment a bumper touches you.</li>
<li><b>Three road perks</b> — coins (86%), shields (11.5%) that absorb one crash and then expire on their own after <code>15 s</code>, and swap tokens (3.5%) that turn every car on screen into a coin and grant <code>1600 ms</code> of slow motion.</li>
<li><b>Impact that reads</b> — a hit costs a life, adds <code>1050 ms</code> of blink-invincibility, kicks the car sideways by <code>56 px</code> and slows the world to 35% for the last crash.</li>
<li><b>Sound from oscillators</b> — every beep is a WebAudio oscillator with an envelope, so there is not a single audio file in the repository.</li>
<li><b>A local leaderboard</b> — your best run and your six best runs are kept in <code>localStorage</code> and read through <code>useSyncExternalStore</code>, so the start screen, the HUD and the game-over sheet all agree without prop drilling.</li>
<li><b>Share without a server</b> — the game-over button calls <code>navigator.share</code> where it exists and falls back to the clipboard, with the button itself reporting "copied".</li>
<li><b>Bilingual</b> — <code>en-US</code> and <code>zh-CN</code> behind one provider, with the preference stored in both a cookie and <code>localStorage</code> so the server can render the right <code>lang</code> on the first paint.</li>
</ul>

---

<div align="center">

## Stack

</div>

<pre><code>Next.js        App Router, one client component tree for the game
React          state for phase · HUD · telemetry; refs for the loop
TypeScript     typed landmarks, obstacles, prize tokens
Canvas 2D      900 × 1400 internal surface, drawn every frame
MediaPipe      Hands + camera_utils + drawing_utils via jsDelivr
framer-motion   intro, calibration and game-over choreography
i18next        en-US · zh-CN
Tailwind v4     tokens for the amber-on-asphalt palette
WebAudio        oscillator beeps, zero audio assets</code></pre>

<div align="center">

<img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,vercel,git" alt="Next.js, React, TypeScript, Tailwind, Vercel, Git" />

</div>

---

<div align="center">

## Under the hood

</div>

<details>
<summary><b>A fist detected from joint order, not from a classifier</b></summary>

<br />

<p>MediaPipe hands back 21 normalised landmarks per hand — tips at <code>8 · 12 · 16 · 20</code>, middle joints at <code>6 · 10 · 14 · 18</code>. Image space puts the origin at the top left, so a curled finger points down and its tip sits at a larger <code>y</code> than its joint:</p>

<pre><code>function isFist(landmarks: Landmark[]) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let curled = 0;
  tips.forEach((tip, index) =&gt; {
    if (landmarks[tip] &amp;&amp; landmarks[pips[index]] &amp;&amp; landmarks[tip].y &gt; landmarks[pips[index]].y) curled += 1;
  });
  return curled &gt;= 3;
}</code></pre>

<p>Comparing a joint against a joint keeps this scale-independent: leaning closer to the lens changes every coordinate but not the ordering, so the gesture survives a player who sits at a different distance from a player who tested it. A trained gesture classifier would have needed its own model, its own download and its own failure mode; this is eleven lines and cannot go stale.</p>

</details>

<details>
<summary><b>Two filters, because one is either laggy or twitchy</b></summary>

<br />

<p>Landmark noise at 15 fps is several pixels wide and reads as a car that shivers in its lane. Smoothing happens before the position ever becomes a target, then a second, softer ease is applied to the car itself:</p>

<pre><code>const mirroredX = 1 - palmX;                       // mirror, so hand and car agree
const smoothed = previous + (mirroredX - previous) * 0.18;
carRef.current.targetX = clamp(smoothed * WIDTH, 130, WIDTH - 130);
// in the loop
carRef.current.x += (targetX + recoil - carRef.current.x) * 0.1;</code></pre>

<p>The hand filter is fast enough to cross four lanes in about a third of a second. The car filter is what makes a lane change look like a lane change: the target can jump, the car cannot, and the leftover distance becomes visible momentum.</p>

</details>

<details>
<summary><b>One canvas that behaves like a window</b></summary>

<br />

<p>Everything is drawn on a fixed <code>900 × 1400</code> surface with lanes at <code>0.22 · 0.39 · 0.56 · 0.73</code> of the width, and CSS stretches that surface with <code>object-cover</code>. So collision maths never divides by a viewport, the same obstacle geometry works on a phone and a desktop, and the camera preview drawn behind it is stretched by the same rule.</p>

<pre><code>const WIDTH = 900, HEIGHT = 1400, CAR_W = 86, CAR_H = 142;
const LANES = [0.22, 0.39, 0.56, 0.73];   // fractions, not pixels</code></pre>

<p>Obstacle and pickup spawn on a lane chosen from that table, and the hit test is a box overlap on <code>x</code>/<code>y</code> distance rather than a physics engine. A dodge game needs one bit of collision truth, not a solver.</p>

</details>

<details>
<summary><b>Difficulty as a single number that three systems read</b></summary>

<br />

<p>There is one <code>speed</code> value, and it is simultaneously the world scroll rate, the traffic rate and the payout rate:</p>

<pre><code>stats.speed = Math.min(18, stats.speed + dt * 0.004);          // the ramp
nextObstacleRef.current = Math.max(36, 84 - stats.speed * 1.5); // the busier road
stats.score += dt * (0.8 + stats.speed * 0.018);               // the higher purse</code></pre>

<p>Because spacing is derived rather than tuned separately, no patch of road can ever be literally impossible: the faster the cars come, the more gaps the spacing rule leaves between them. Raise the cap to <code>18</code> and the game eventually settles into a rhythm the player has to earn, instead of an arbitrary wall.</p>

</details>

<details>
<summary><b>Prize tokens that change the board, not just the score</b></summary>

<br />

<p>Shields and swaps are not score bonuses with a different sprite:</p>

<pre><code>if (token.kind === "shield") { stats.shieldMs = 15000; stats.score += 50; }
else if (token.kind === "swap") {
  stats.swapMs = 1600;
  obstaclesRef.current.forEach((obstacle) =&gt; prizeTokensRef.current.push({ ...coinAt(obstacle) }));
  obstaclesRef.current = [];    // the traffic is gone; every car became a coin
}</code></pre>

<p>A shield is consumed by the next hit — one crash absorbed, then the car blinks through the wreck instead of losing a life. A swap deletes the queue and repopulates it with what those cars were worth, which is the one moment in a run where the correct move is to stop dodging and drive straight.</p>

</details>

<details>
<summary><b>Scores in a store, so nothing has to be passed around</b></summary>

<br />

<p>The best run is read by the start screen, written by the game-over handler, and compared against inside the HUD. Rather than lifting all of that into a provider, <code>src/lib/scores.ts</code> is a tiny external store over <code>localStorage</code>, consumed with <code>useSyncExternalStore</code>:</p>

<pre><code>const bestScore = useSyncExternalStore(
  subscribeScores,
  getBestScoreSnapshot,      // cached read, stable between renders
  getBestScoreServerSnapshot // 0 on the server, which is what the static HTML shows
);</code></pre>

<p>A finished run calls <code>recordRun(score)</code>, which writes the best score and re-sorts the last six runs, invalidates the caches and notifies every subscriber at once. The server snapshot exists so the markup can be rendered statically without hydration mismatches on a browser-only value.</p>

</details>

---

<div align="center">

## Project structure

</div>

<pre><code>tokyo-highway-dodge/
├── src/app/
│   ├── page.tsx                  # mounts the game shell
│   ├── layout.tsx                # fonts, metadata, i18n provider, SSR locale
│   ├── opengraph-image.tsx       # generated share card
│   └── error.tsx · not-found.tsx # road-closed and stalled-system screens
├── src/components/game/
│   ├── patrol-app.tsx            # intro screen, camera permission, fullscreen
│   └── highway-game.tsx          # calibration · game loop · HUD · game over
├── src/lib/
│   ├── scores.ts                 # localStorage store: best run + top six
│   ├── hooks.ts                  # useMounted
│   └── i18n/                     # locale detect, cookie persistence, SSR read
├── src/i18n/                     # i18next setup + en-US / zh-CN resources
└── src/components/ui/            # shared primitives used by the error screens</code></pre>

---

<div align="center">

## Run it

</div>

<pre><code>git clone https://github.com/Jivaansh-Yadav/tokyo-highway-dodge.git
cd tokyo-highway-dodge
npm install
npm run dev            # then open http://localhost:3000 and allow the camera</code></pre>

<p>Camera access needs <code>https</code> or <code>localhost</code> — browsers refuse <code>getUserMedia</code> anywhere else, so a LAN IP will look like a broken permission prompt. The hand model and its WASM binaries are fetched from jsDelivr at load, which means the first run needs a network connection; after that the browser cache usually covers it.</p>

<p>No hosting is wired up in this repository: build with <code>npm run build</code> and serve with <code>npm start</code>, or drop it on any Node host. Scores are per-browser, so a new device starts its own leaderboard.</p>

<div align="center">

<sub>If the car will not move, check the status chip first — it tells you whether the model sees a hand at all, before you blame the gesture.</sub>

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d0e12,55:1a1710,100:FFCC00&height=110&section=footer&reversal=true" alt="" width="100%">
