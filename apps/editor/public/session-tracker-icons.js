const SESSION_TRACKER_SLEEPING_PEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 170" width="260" height="170" aria-hidden="true" focusable="false">
  <style>
    .floaty {
      transform-origin: 130px 84px;
      animation: sleepyFloat 3.6s ease-in-out infinite;
    }

    .shadow {
      transform-origin: 130px 124px;
      animation: shadowPulse 3.6s ease-in-out infinite;
      opacity: 0.14;
    }

    .zzz1 {
      animation: zDrift1 2.8s ease-in-out infinite;
    }

    .zzz2 {
      animation: zDrift2 3.2s ease-in-out infinite;
    }

    .zzz3 {
      animation: zDrift3 3.6s ease-in-out infinite;
    }

    @keyframes sleepyFloat {
      0%, 100% {
        transform: translateY(0px) rotate(2deg);
      }
      50% {
        transform: translateY(-6px) rotate(3deg);
      }
    }

    @keyframes shadowPulse {
      0%, 100% {
        transform: scaleX(1) scaleY(1);
        opacity: 0.15;
      }
      50% {
        transform: scaleX(0.92) scaleY(0.92);
        opacity: 0.09;
      }
    }

    @keyframes zDrift1 {
      0%   { opacity: 0; transform: translate(0px, 0px) scale(0.85); }
      20%  { opacity: 0.6; }
      100% { opacity: 0; transform: translate(8px, -18px) scale(1.05); }
    }

    @keyframes zDrift2 {
      0%   { opacity: 0; transform: translate(0px, 0px) scale(0.9); }
      25%  { opacity: 0.5; }
      100% { opacity: 0; transform: translate(10px, -22px) scale(1.1); }
    }

    @keyframes zDrift3 {
      0%   { opacity: 0; transform: translate(0px, 0px) scale(0.95); }
      30%  { opacity: 0.45; }
      100% { opacity: 0; transform: translate(11px, -26px) scale(1.15); }
    }

    text {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      fill: #d9e8ff;
    }
  </style>

  <ellipse class="shadow" cx="130" cy="126" rx="74" ry="12" fill="black"/>

  <g>
    <text class="zzz1" x="76" y="42" font-size="16">z</text>
    <text class="zzz2" x="92" y="28" font-size="18">z</text>
    <text class="zzz3" x="110" y="14" font-size="20">Z</text>
  </g>

  <g class="floaty">
    <g transform="rotate(2 130 84)">
      <rect x="42" y="70" width="68" height="34" rx="15" fill="#111820"/>
      <rect x="99" y="74" width="100" height="26" rx="12" fill="#111820"/>
      <rect x="100" y="77" width="8" height="20" rx="3" fill="#F2F2F2"/>
      <rect x="178" y="77" width="7" height="20" rx="3" fill="#F2F2F2"/>

      <path d="M60 76 C78 61, 99 61, 113 74" fill="none" stroke="#F2F2F2" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="111" cy="74" r="3.2" fill="#F2F2F2"/>

      <path d="M198 76 L220 76 L230 87 L220 98 L198 98 Z" fill="#111820"/>
      <path d="M220 76 L242 87 L220 98 Z" fill="#111820"/>
      <path
        d="M227 83 L236 87 L227 91"
        fill="none"
        stroke="#F2F2F2"
        stroke-width="2.1"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="226.5" cy="87" r="2.7" fill="#F2F2F2"/>
    </g>
  </g>
</svg>
`;

const SESSION_TRACKER_WORKING_PEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220" aria-hidden="true" focusable="false">
  <style>
    .pen-motion {
      transform-origin: 105px 214px;
      animation: writeNudge 1.25s ease-in-out infinite;
    }

    @keyframes writeNudge {
      0% { transform: translate(0px, 0px) rotate(0deg); }
      18% { transform: translate(0.6px, 0.9px) rotate(0.2deg); }
      42% { transform: translate(-0.25px, -0.2px) rotate(-0.12deg); }
      68% { transform: translate(0.7px, 1px) rotate(0.24deg); }
      100% { transform: translate(0px, 0px) rotate(0deg); }
    }
  </style>

  <ellipse cx="110" cy="184" rx="42" ry="10" fill="black" opacity="0.10"/>

  <g transform="rotate(-28 110 110)">
    <g class="pen-motion">
      <rect x="78" y="42" width="54" height="48" rx="18" fill="#111820"/>
      <rect x="82" y="72" width="46" height="92" rx="18" fill="#111820"/>
      <rect x="82" y="88" width="46" height="5" rx="2.5" fill="#F2F2F2"/>
      <rect x="84" y="156" width="42" height="5" rx="2.5" fill="#F2F2F2"/>

      <path
        d="M123 52 C142 76, 139 106, 123 122"
        fill="none"
        stroke="#F2F2F2"
        stroke-width="5"
        stroke-linecap="round"
      />

      <circle cx="123" cy="122" r="5.5" fill="#111820"/>
      <circle cx="123" cy="122" r="2.5" fill="#F2F2F2"/>

      <path d="M86 160 L124 160 L116 186 L94 186 Z" fill="#111820"/>
      <path d="M94 186 L116 186 L105 214 Z" fill="#111820"/>

      <path
        d="M105 194 L105 209"
        stroke="#F2F2F2"
        stroke-width="2.5"
        stroke-linecap="round"
      />

      <circle cx="105" cy="197" r="3.5" fill="#F2F2F2"/>
    </g>
  </g>
</svg>
`;

const SESSION_TRACKER_FLAMING_PEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" aria-hidden="true" focusable="false">
  <style>
    .pen {
      filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.35));
    }

    .outer-flame {
      transform-origin: 180px 332px;
      animation: flameFlicker 0.75s infinite ease-in-out alternate;
    }

    .mid-flame {
      transform-origin: 180px 332px;
      animation: flameFlicker 0.58s infinite ease-in-out alternate-reverse;
    }

    .inner-flame {
      transform-origin: 180px 332px;
      animation: innerPulse 0.46s infinite ease-in-out alternate;
    }

    .small-flame {
      transform-origin: 180px 332px;
      animation: smallFlicker 0.62s infinite ease-in-out alternate;
    }

    .glow {
      transform-origin: 180px 332px;
      animation: glowPulse 0.5s infinite ease-in-out alternate;
    }

    @keyframes flameFlicker {
      0% {
        transform: scaleY(0.96) scaleX(1.02) translateY(2px) rotate(-1deg);
        opacity: 0.93;
      }
      100% {
        transform: scaleY(1.08) scaleX(0.97) translateY(-6px) rotate(2deg);
        opacity: 1;
      }
    }

    @keyframes innerPulse {
      0% {
        transform: scale(0.94) translateY(3px);
        opacity: 0.75;
      }
      100% {
        transform: scale(1.08) translateY(-4px);
        opacity: 1;
      }
    }

    @keyframes smallFlicker {
      0% {
        transform: translateY(2px) rotate(-2deg) scale(0.94);
        opacity: 0.72;
      }
      100% {
        transform: translateY(-4px) rotate(3deg) scale(1.07);
        opacity: 1;
      }
    }

    @keyframes glowPulse {
      0% {
        opacity: 0.28;
        transform: scale(0.95);
      }
      100% {
        opacity: 0.52;
        transform: scale(1.08);
      }
    }
  </style>

  <g transform="rotate(-35 200 220)">
    <g id="flame-cluster" transform="translate(12 -6) rotate(-12 180 332)">
      <ellipse class="glow" cx="181" cy="332" rx="20" ry="14" fill="#ff9a1f" opacity="0.35"/>
      <ellipse class="glow" cx="187" cy="318" rx="14" ry="10" fill="#ffd23c" opacity="0.22"/>

      <path
        class="outer-flame"
        d="M180 336
          C160 318, 154 292, 166 270
          C148 266, 144 244, 156 226
          C150 196, 166 172, 188 158
          C184 128, 202 102, 226 84
          C224 116, 248 126, 260 154
          C280 144, 296 158, 294 182
          C316 188, 324 214, 312 236
          C320 264, 306 290, 278 306
          C254 320, 226 322, 204 314
          C197 326, 190 333, 180 336
          Z"
        fill="#ff1f0f"
      />

      <path
        class="mid-flame"
        d="M181 335
          C168 316, 166 292, 176 275
          C164 268, 162 250, 172 236
          C170 210, 184 192, 202 180
          C202 152, 218 132, 236 120
          C236 140, 252 150, 258 168
          C274 162, 286 174, 284 192
          C300 200, 302 220, 292 238
          C294 260, 282 280, 260 292
          C238 304, 214 306, 198 300
          C193 313, 187 324, 181 335
          Z"
        fill="#ff7a00"
      />

      <path
        class="inner-flame"
        d="M182 334
          C176 316, 178 298, 188 284
          C182 274, 184 258, 194 246
          C194 224, 206 208, 220 198
          C220 176, 232 160, 244 150
          C244 166, 254 176, 258 190
          C270 186, 278 196, 276 210
          C286 220, 286 236, 280 250
          C278 266, 266 280, 248 290
          C230 298, 210 300, 196 294
          C190 308, 186 320, 182 334
          Z"
        fill="#ffd23c"
      />

      <path
        class="small-flame"
        d="M169 334
          C156 320, 154 302, 162 288
          C153 288, 148 276, 152 264
          C166 276, 172 298, 169 334
          Z"
        fill="#ff5a00"
      />

      <path
        class="small-flame"
        d="M193 332
          C209 320, 218 302, 218 284
          C232 288, 238 272, 234 258
          C248 272, 244 298, 193 332
          Z"
        fill="#ff3b12"
      />
    </g>

    <g class="pen">
      <rect x="140" y="95" width="80" height="70" rx="26" fill="#111820"/>
      <rect x="145" y="135" width="70" height="155" rx="24" fill="#111820"/>
      <rect x="145" y="160" width="70" height="8" rx="4" fill="#f2f2f2"/>
      <rect x="148" y="280" width="64" height="8" rx="4" fill="#f2f2f2"/>

      <path d="M205 110 C235 145, 230 195, 205 220" fill="none" stroke="#f2f2f2" stroke-width="7" stroke-linecap="round"/>
      <circle cx="205" cy="220" r="8" fill="#111820"/>
      <circle cx="205" cy="220" r="4" fill="#f2f2f2"/>

      <path d="M150 288 L210 288 L198 330 L162 330 Z" fill="#111820"/>
      <path d="M162 330 L198 330 L180 380 Z" fill="#111820"/>
      <path d="M180 342 L180 375" stroke="#f2f2f2" stroke-width="4" stroke-linecap="round"/>
      <circle cx="180" cy="346" r="6" fill="#f2f2f2"/>
    </g>
  </g>
</svg>
`;

export function renderSessionTrackerPenSvg(state) {
  switch (state) {
    case "sleeping":
      return SESSION_TRACKER_SLEEPING_PEN_SVG;
    case "flaming":
      return SESSION_TRACKER_FLAMING_PEN_SVG;
    case "working":
    default:
      return SESSION_TRACKER_WORKING_PEN_SVG;
  }
}
