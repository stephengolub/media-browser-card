import {
  css,
  html,
  LitElement,
} from "https://unpkg.com/lit-element@3.0.1/lit-element.js?module";

const folderIcon = html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
`;
const fileIcon = html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="icon w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
`;

const BROWSER_PLAYER = {
  entity_id: "browser",
  attributes: {
    friendly_name: "Browser",
  },
};

function getMediaPlayers(hass) {
  const filteredPlayers = Object.values(hass.states).filter(
    (entity) =>
      entity.entity_id.match(/^media_player\./) &&
      (entity.attributes.supported_features & 131072) !== 0
  );

  return [BROWSER_PLAYER, ...filteredPlayers];
}

async function browseMedia(hass, mediaContentId) {
  return hass.callWS({
    type: "media_source/browse_media",
    media_content_id: mediaContentId,
  });
}

async function playMedia(hass, entity_id, item) {
  return hass.callService("media_player", "play_media", {
    entity_id,
    media_content_id: item.media_content_id,
    media_content_type: item.media_content_type,
  });
}

async function playMediaInBrowser(hass, item) {
  const resolvedUrl = await hass.callWS({
    type: "media_source/resolve_media",
    media_content_id: item.media_content_id,
  });

  // Ideally we would like to open a dialog, as is done here: https://github.com/home-assistant/frontend/blob/c26a59d8059497104ed52ad44b17146547f0173c/src/panels/media-browser/ha-panel-media-browser.ts#L96
  // For now just open a new tab
  window.open(resolvedUrl.url, "_blank");
}

function getCurrentProgress(stateObj) {
  let progress = stateObj.attributes.media_position;

  if (stateObj.state !== "playing") {
    return progress;
  }
  progress +=
    (Date.now() -
      new Date(stateObj.attributes.media_position_updated_at).getTime()) /
    1000.0;
  // Prevent negative values, so we do not go back to 59:59 at the start
  // for example if there are slight clock sync deltas between backend and frontend and
  // therefore media_position_updated_at might be slightly larger than Date.now().
  return progress < 0 ? 0 : progress;
}

function isDirectory(item) {
  return ["directory", "app"].includes(item.media_class);
}

let clientData;

function loadClientData() {
  const clientDataJson = localStorage.getItem("homeassistant.mediabrowsercard");

  if (clientDataJson) {
    clientData = JSON.parse(clientDataJson);
  }

  clientData = Object.assign(
    {},
    {
      playedItemIds: [],
      currentPath: [],
    },
    clientData
  );
}

loadClientData();

function updateClientData(changes) {
  clientData = Object.assign({}, clientData, changes);
  const clientDataJson = JSON.stringify(clientData);

  localStorage.setItem("homeassistant.mediabrowsercard", clientDataJson);
}

class MediaBrowserCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _currentDirectoryItem: { state: true },
      _currentPlayingItemId: { state: true },
      _currentPath: { state: true },
      _availablePlayers: { state: true },
      _selectedPlayer: { state: true },
      _menuOpened: { state: true },
      _seekDelta: { state: true },
    };
  }

  static get styles() {
    return css`
*, ::before, ::after {
  --tw-border-spacing-x: 0;
  --tw-border-spacing-y: 0;
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-pan-x:  ;
  --tw-pan-y:  ;
  --tw-pinch-zoom:  ;
  --tw-scroll-snap-strictness: proximity;
  --tw-gradient-from-position:  ;
  --tw-gradient-via-position:  ;
  --tw-gradient-to-position:  ;
  --tw-ordinal:  ;
  --tw-slashed-zero:  ;
  --tw-numeric-figure:  ;
  --tw-numeric-spacing:  ;
  --tw-numeric-fraction:  ;
  --tw-ring-inset:  ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
  --tw-blur:  ;
  --tw-brightness:  ;
  --tw-contrast:  ;
  --tw-grayscale:  ;
  --tw-hue-rotate:  ;
  --tw-invert:  ;
  --tw-saturate:  ;
  --tw-sepia:  ;
  --tw-drop-shadow:  ;
  --tw-backdrop-blur:  ;
  --tw-backdrop-brightness:  ;
  --tw-backdrop-contrast:  ;
  --tw-backdrop-grayscale:  ;
  --tw-backdrop-hue-rotate:  ;
  --tw-backdrop-invert:  ;
  --tw-backdrop-opacity:  ;
  --tw-backdrop-saturate:  ;
  --tw-backdrop-sepia:  ;
  --tw-contain-size:  ;
  --tw-contain-layout:  ;
  --tw-contain-paint:  ;
  --tw-contain-style:  ;
}

::backdrop {
  --tw-border-spacing-x: 0;
  --tw-border-spacing-y: 0;
  --tw-translate-x: 0;
  --tw-translate-y: 0;
  --tw-rotate: 0;
  --tw-skew-x: 0;
  --tw-skew-y: 0;
  --tw-scale-x: 1;
  --tw-scale-y: 1;
  --tw-pan-x:  ;
  --tw-pan-y:  ;
  --tw-pinch-zoom:  ;
  --tw-scroll-snap-strictness: proximity;
  --tw-gradient-from-position:  ;
  --tw-gradient-via-position:  ;
  --tw-gradient-to-position:  ;
  --tw-ordinal:  ;
  --tw-slashed-zero:  ;
  --tw-numeric-figure:  ;
  --tw-numeric-spacing:  ;
  --tw-numeric-fraction:  ;
  --tw-ring-inset:  ;
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: rgb(59 130 246 / 0.5);
  --tw-ring-offset-shadow: 0 0 #0000;
  --tw-ring-shadow: 0 0 #0000;
  --tw-shadow: 0 0 #0000;
  --tw-shadow-colored: 0 0 #0000;
  --tw-blur:  ;
  --tw-brightness:  ;
  --tw-contrast:  ;
  --tw-grayscale:  ;
  --tw-hue-rotate:  ;
  --tw-invert:  ;
  --tw-saturate:  ;
  --tw-sepia:  ;
  --tw-drop-shadow:  ;
  --tw-backdrop-blur:  ;
  --tw-backdrop-brightness:  ;
  --tw-backdrop-contrast:  ;
  --tw-backdrop-grayscale:  ;
  --tw-backdrop-hue-rotate:  ;
  --tw-backdrop-invert:  ;
  --tw-backdrop-opacity:  ;
  --tw-backdrop-saturate:  ;
  --tw-backdrop-sepia:  ;
  --tw-contain-size:  ;
  --tw-contain-layout:  ;
  --tw-contain-paint:  ;
  --tw-contain-style:  ;
}/*
! tailwindcss v3.4.13 | MIT License | https://tailwindcss.com
*//*
1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)
2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)
*/

*,
::before,
::after {
  box-sizing: border-box; /* 1 */
  border-width: 0; /* 2 */
  border-style: solid; /* 2 */
  border-color: #e5e7eb; /* 2 */
}

::before,
::after {
  --tw-content: '';
}

/*
1. Use a consistent sensible line-height in all browsers.
2. Prevent adjustments of font size after orientation changes in iOS.
3. Use a more readable tab size.
4. Use the user's configured \`sans\` font-family by default.
5. Use the user's configured \`sans\` font-feature-settings by default.
6. Use the user's configured \`sans\` font-variation-settings by default.
7. Disable tap highlights on iOS
*/

html,
:host {
  line-height: 1.5; /* 1 */
  -webkit-text-size-adjust: 100%; /* 2 */
  -moz-tab-size: 4; /* 3 */
  tab-size: 4; /* 3 */
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; /* 4 */
  font-feature-settings: normal; /* 5 */
  font-variation-settings: normal; /* 6 */
  -webkit-tap-highlight-color: transparent; /* 7 */
}

/*
1. Remove the margin in all browsers.
2. Inherit line-height from \`html\` so users can set them as a class directly on the \`html\` element.
*/

body {
  margin: 0; /* 1 */
  line-height: inherit; /* 2 */
}

/*
1. Add the correct height in Firefox.
2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)
3. Ensure horizontal rules are visible by default.
*/

hr {
  height: 0; /* 1 */
  color: inherit; /* 2 */
  border-top-width: 1px; /* 3 */
}

/*
Add the correct text decoration in Chrome, Edge, and Safari.
*/

abbr:where([title]) {
  text-decoration: underline dotted;
}

/*
Remove the default font size and weight for headings.
*/

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

/*
Reset links to optimize for opt-in styling instead of opt-out.
*/

a {
  color: inherit;
  text-decoration: inherit;
}

/*
Add the correct font weight in Edge and Safari.
*/

b,
strong {
  font-weight: bolder;
}

/*
1. Use the user's configured \`mono\` font-family by default.
2. Use the user's configured \`mono\` font-feature-settings by default.
3. Use the user's configured \`mono\` font-variation-settings by default.
4. Correct the odd \`em\` font sizing in all browsers.
*/

code,
kbd,
samp,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; /* 1 */
  font-feature-settings: normal; /* 2 */
  font-variation-settings: normal; /* 3 */
  font-size: 1em; /* 4 */
}

/*
Add the correct font size in all browsers.
*/

small {
  font-size: 80%;
}

/*
Prevent \`sub\` and \`sup\` elements from affecting the line height in all browsers.
*/

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

/*
1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)
2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)
3. Remove gaps between table borders by default.
*/

table {
  text-indent: 0; /* 1 */
  border-color: inherit; /* 2 */
  border-collapse: collapse; /* 3 */
}

/*
1. Change the font styles in all browsers.
2. Remove the margin in Firefox and Safari.
3. Remove default padding in all browsers.
*/

button,
input,
optgroup,
select,
textarea {
  font-family: inherit; /* 1 */
  font-feature-settings: inherit; /* 1 */
  font-variation-settings: inherit; /* 1 */
  font-size: 100%; /* 1 */
  font-weight: inherit; /* 1 */
  line-height: inherit; /* 1 */
  letter-spacing: inherit; /* 1 */
  color: inherit; /* 1 */
  margin: 0; /* 2 */
  padding: 0; /* 3 */
}

/*
Remove the inheritance of text transform in Edge and Firefox.
*/

button,
select {
  text-transform: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Remove default button styles.
*/

button,
input:where([type='button']),
input:where([type='reset']),
input:where([type='submit']) {
  -webkit-appearance: button; /* 1 */
  background-color: transparent; /* 2 */
  background-image: none; /* 2 */
}

/*
Use the modern Firefox focus style for all focusable elements.
*/

:-moz-focusring {
  outline: auto;
}

/*
Remove the additional \`:invalid\` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)
*/

:-moz-ui-invalid {
  box-shadow: none;
}

/*
Add the correct vertical alignment in Chrome and Firefox.
*/

progress {
  vertical-align: baseline;
}

/*
Correct the cursor style of increment and decrement buttons in Safari.
*/

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

/*
1. Correct the odd appearance in Chrome and Safari.
2. Correct the outline style in Safari.
*/

[type='search'] {
  -webkit-appearance: textfield; /* 1 */
  outline-offset: -2px; /* 2 */
}

/*
Remove the inner padding in Chrome and Safari on macOS.
*/

::-webkit-search-decoration {
  -webkit-appearance: none;
}

/*
1. Correct the inability to style clickable types in iOS and Safari.
2. Change font properties to \`inherit\` in Safari.
*/

::-webkit-file-upload-button {
  -webkit-appearance: button; /* 1 */
  font: inherit; /* 2 */
}

/*
Add the correct display in Chrome and Safari.
*/

summary {
  display: list-item;
}

/*
Removes the default spacing and border for appropriate elements.
*/

blockquote,
dl,
dd,
h1,
h2,
h3,
h4,
h5,
h6,
hr,
figure,
p,
pre {
  margin: 0;
}

fieldset {
  margin: 0;
  padding: 0;
}

legend {
  padding: 0;
}

ol,
ul,
menu {
  list-style: none;
  margin: 0;
  padding: 0;
}

/*
Reset default styling for dialogs.
*/
dialog {
  padding: 0;
}

/*
Prevent resizing textareas horizontally by default.
*/

textarea {
  resize: vertical;
}

/*
1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)
2. Set the default placeholder color to the user's configured gray 400 color.
*/

input::placeholder,
textarea::placeholder {
  opacity: 1; /* 1 */
  color: #9ca3af; /* 2 */
}

/*
Set the default cursor for buttons.
*/

button,
[role="button"] {
  cursor: pointer;
}

/*
Make sure disabled buttons don't get the pointer cursor.
*/
:disabled {
  cursor: default;
}

/*
1. Make replaced elements \`display: block\` by default. (https://github.com/mozdevs/cssremedy/issues/14)
2. Add \`vertical-align: middle\` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)
   This can trigger a poorly considered lint error in some tools but is included by design.
*/

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block; /* 1 */
  vertical-align: middle; /* 2 */
}

/*
Constrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)
*/

img,
video {
  max-width: 100%;
  height: auto;
}

/* Make elements with the HTML hidden attribute stay hidden by default */
[hidden] {
  display: none;
}

[type='text'],input:where(:not([type])),[type='email'],[type='url'],[type='password'],[type='number'],[type='date'],[type='datetime-local'],[type='month'],[type='search'],[type='tel'],[type='time'],[type='week'],[multiple],textarea,select {
  appearance: none;
  background-color: #fff;
  border-color: #6b7280;
  border-width: 1px;
  border-radius: 0px;
  padding-top: 0.5rem;
  padding-right: 0.75rem;
  padding-bottom: 0.5rem;
  padding-left: 0.75rem;
  font-size: 1rem;
  line-height: 1.5rem;
  --tw-shadow: 0 0 #0000;
}

[type='text']:focus, input:where(:not([type])):focus, [type='email']:focus, [type='url']:focus, [type='password']:focus, [type='number']:focus, [type='date']:focus, [type='datetime-local']:focus, [type='month']:focus, [type='search']:focus, [type='tel']:focus, [type='time']:focus, [type='week']:focus, [multiple]:focus, textarea:focus, select:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/);
  --tw-ring-offset-width: 0px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: #2563eb;
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  border-color: #2563eb;
}

input::placeholder,textarea::placeholder {
  color: #6b7280;
  opacity: 1;
}

::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}

::-webkit-date-and-time-value {
  min-height: 1.5em;
  text-align: inherit;
}

::-webkit-datetime-edit {
  display: inline-flex;
}

::-webkit-datetime-edit,::-webkit-datetime-edit-year-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-meridiem-field {
  padding-top: 0;
  padding-bottom: 0;
}

select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
  print-color-adjust: exact;
}

[multiple],[size]:where(select:not([size="1"])) {
  background-image: initial;
  background-position: initial;
  background-repeat: unset;
  background-size: initial;
  padding-right: 0.75rem;
  print-color-adjust: unset;
}

[type='checkbox'],[type='radio'] {
  appearance: none;
  padding: 0;
  print-color-adjust: exact;
  display: inline-block;
  vertical-align: middle;
  background-origin: border-box;
  user-select: none;
  flex-shrink: 0;
  height: 1rem;
  width: 1rem;
  color: #2563eb;
  background-color: #fff;
  border-color: #6b7280;
  border-width: 1px;
  --tw-shadow: 0 0 #0000;
}

[type='checkbox'] {
  border-radius: 0px;
}

[type='radio'] {
  border-radius: 100%;
}

[type='checkbox']:focus,[type='radio']:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/);
  --tw-ring-offset-width: 2px;
  --tw-ring-offset-color: #fff;
  --tw-ring-color: #2563eb;
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
}

[type='checkbox']:checked,[type='radio']:checked {
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

[type='checkbox']:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
}

@media (forced-colors: active)  {

  [type='checkbox']:checked {
    appearance: auto;
  }
}

[type='radio']:checked {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
}

@media (forced-colors: active)  {

  [type='radio']:checked {
    appearance: auto;
  }
}

[type='checkbox']:checked:hover,[type='checkbox']:checked:focus,[type='radio']:checked:hover,[type='radio']:checked:focus {
  border-color: transparent;
  background-color: currentColor;
}

[type='checkbox']:indeterminate {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3e%3c/svg%3e");
  border-color: transparent;
  background-color: currentColor;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
}

@media (forced-colors: active)  {

  [type='checkbox']:indeterminate {
    appearance: auto;
  }
}

[type='checkbox']:indeterminate:hover,[type='checkbox']:indeterminate:focus {
  border-color: transparent;
  background-color: currentColor;
}

[type='file'] {
  background: unset;
  border-color: inherit;
  border-width: 0;
  border-radius: 0;
  padding: 0;
  font-size: unset;
  line-height: inherit;
}

[type='file']:focus {
  outline: 1px solid ButtonText;
  outline: 1px auto -webkit-focus-ring-color;
}
  .static {
  position: static;
}
  .absolute {
  position: absolute;
}
  .relative {
  position: relative;
}
  .right-0 {
  right: 0px;
}
  .z-10 {
  z-index: 10;
}
  .mt-2 {
  margin-top: 0.5rem;
}
  .block {
  display: block;
}
  .inline-block {
  display: inline-block;
}
  .flex {
  display: flex;
}
  .inline-flex {
  display: inline-flex;
}
  .table {
  display: table;
}
  .h-5 {
  height: 1.25rem;
}
  .h-full {
  height: 100%;
}
  .w-5 {
  width: 1.25rem;
}
  .w-56 {
  width: 14rem;
}
  .w-full {
  width: 100%;
}
  .min-w-full {
  min-width: 100%;
}
  .flex-1 {
  flex: 1 1 0%;
}
  .origin-top-right {
  transform-origin: top right;
}
  .transform {
  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}
  .flex-col {
  flex-direction: column;
}
  .items-center {
  align-items: center;
}
  .justify-center {
  justify-content: center;
}
  .justify-between {
  justify-content: space-between;
}
  .gap-2 {
  gap: 0.5rem;
}
  .gap-4 {
  gap: 1rem;
}
  .gap-x-1\\.5 {
  column-gap: 0.375rem;
}
  .divide-y > :not([hidden]) ~ :not([hidden]) {
  --tw-divide-y-reverse: 0;
  border-top-width: calc(1px * calc(1 - var(--tw-divide-y-reverse)));
  border-bottom-width: calc(1px * var(--tw-divide-y-reverse));
}
  .divide-gray-200 > :not([hidden]) ~ :not([hidden]) {
  --tw-divide-opacity: 1;
  border-color: rgb(229 231 235 / var(--tw-divide-opacity));
}
  .self-stretch {
  align-self: stretch;
}
  .overflow-hidden {
  overflow: hidden;
}
  .overflow-y-auto {
  overflow-y: auto;
}
  .rounded {
  border-radius: 0.25rem;
}
  .rounded-lg {
  border-radius: 0.5rem;
}
  .rounded-md {
  border-radius: 0.375rem;
}
  .border-0 {
  border-width: 0px;
}
  .bg-gray-50 {
  --tw-bg-opacity: 1;
  background-color: rgb(249 250 251 / var(--tw-bg-opacity));
}
  .bg-indigo-50 {
  --tw-bg-opacity: 1;
  background-color: rgb(238 242 255 / var(--tw-bg-opacity));
}
  .bg-white {
  --tw-bg-opacity: 1;
  background-color: rgb(255 255 255 / var(--tw-bg-opacity));
}
  .p-4 {
  padding: 1rem;
}
  .px-2 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
  .px-4 {
  padding-left: 1rem;
  padding-right: 1rem;
}
  .py-1 {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}
  .py-1\\.5 {
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
}
  .py-2 {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
  .py-3\\.5 {
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
}
  .pl-3 {
  padding-left: 0.75rem;
}
  .pl-4 {
  padding-left: 1rem;
}
  .pr-10 {
  padding-right: 2.5rem;
}
  .text-left {
  text-align: left;
}
  .text-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
}
  .text-sm {
  font-size: 0.875rem;
  line-height: 1.25rem;
}
  .font-medium {
  font-weight: 500;
}
  .font-semibold {
  font-weight: 600;
}
  .text-gray-600 {
  --tw-text-opacity: 1;
  color: rgb(75 85 99 / var(--tw-text-opacity));
}
  .text-gray-700 {
  --tw-text-opacity: 1;
  color: rgb(55 65 81 / var(--tw-text-opacity));
}
  .text-gray-900 {
  --tw-text-opacity: 1;
  color: rgb(17 24 39 / var(--tw-text-opacity));
}
  .text-indigo-700 {
  --tw-text-opacity: 1;
  color: rgb(67 56 202 / var(--tw-text-opacity));
}
  .shadow {
  --tw-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --tw-shadow-colored: 0 1px 3px 0 var(--tw-shadow-color), 0 1px 2px -1px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}
  .shadow-lg {
  --tw-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}
  .shadow-sm {
  --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
}
  .ring-1 {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}
  .ring-inset {
  --tw-ring-inset: inset;
}
  .ring-black {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(0 0 0 / var(--tw-ring-opacity));
}
  .ring-gray-300 {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(209 213 219 / var(--tw-ring-opacity));
}
  .ring-opacity-5 {
  --tw-ring-opacity: 0.05;
}
  .filter {
  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
}

      :host {
        display: block;
        height: var(--media-card-height, 500px);
      }

  .hover\\:bg-gray-100:hover {
  --tw-bg-opacity: 1;
  background-color: rgb(243 244 246 / var(--tw-bg-opacity));
}

  .hover\\:bg-gray-50:hover {
  --tw-bg-opacity: 1;
  background-color: rgb(249 250 251 / var(--tw-bg-opacity));
}

  .hover\\:bg-indigo-100:hover {
  --tw-bg-opacity: 1;
  background-color: rgb(224 231 255 / var(--tw-bg-opacity));
}

  .focus\\:outline-none:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

  .focus\\:ring-2:focus {
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

  .focus\\:ring-indigo-600:focus {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(79 70 229 / var(--tw-ring-opacity));
}

  @media (prefers-color-scheme: dark) {

  .dark\\:divide-gray-700 > :not([hidden]) ~ :not([hidden]) {
    --tw-divide-opacity: 1;
    border-color: rgb(55 65 81 / var(--tw-divide-opacity));
  }

  .dark\\:bg-gray-700 {
    --tw-bg-opacity: 1;
    background-color: rgb(55 65 81 / var(--tw-bg-opacity));
  }

  .dark\\:bg-gray-800 {
    --tw-bg-opacity: 1;
    background-color: rgb(31 41 55 / var(--tw-bg-opacity));
  }

  .dark\\:bg-indigo-800 {
    --tw-bg-opacity: 1;
    background-color: rgb(55 48 163 / var(--tw-bg-opacity));
  }

  .dark\\:text-gray-200 {
    --tw-text-opacity: 1;
    color: rgb(229 231 235 / var(--tw-text-opacity));
  }

  .dark\\:text-gray-400 {
    --tw-text-opacity: 1;
    color: rgb(156 163 175 / var(--tw-text-opacity));
  }

  .dark\\:text-indigo-200 {
    --tw-text-opacity: 1;
    color: rgb(199 210 254 / var(--tw-text-opacity));
  }

  .dark\\:ring-gray-500 {
    --tw-ring-opacity: 1;
    --tw-ring-color: rgb(107 114 128 / var(--tw-ring-opacity));
  }

  .dark\\:ring-gray-600 {
    --tw-ring-opacity: 1;
    --tw-ring-color: rgb(75 85 99 / var(--tw-ring-opacity));
  }

  .dark\\:hover\\:bg-gray-600:hover {
    --tw-bg-opacity: 1;
    background-color: rgb(75 85 99 / var(--tw-bg-opacity));
  }

  .dark\\:hover\\:bg-gray-700:hover {
    --tw-bg-opacity: 1;
    background-color: rgb(55 65 81 / var(--tw-bg-opacity));
  }

  .dark\\:hover\\:bg-indigo-700:hover {
    --tw-bg-opacity: 1;
    background-color: rgb(67 56 202 / var(--tw-bg-opacity));
  }
}
    `;
  }

  constructor() {
    super();
    this._currentPath = clientData.currentPath;
    this._availablePlayers = [];
    this._menuOpened = false;
    this._seekDelta = 0;
  }

  firstUpdated() {
    this.loadCurrentDirectory();
  }

  updated(changedProps) {
    super.updated(changedProps);

    if (changedProps.has("hass")) {
      // Update available media players
      this._availablePlayers = this.hass ? getMediaPlayers(this.hass) : [];
      const isSelectedPlayerAvailable = this._selectedPlayer
        ? this._availablePlayers.some(
            (player) => player.entity_id === this._selectedPlayer.entity_id
          )
        : false;
      if (!isSelectedPlayerAvailable) {
        const newPlayer =
          this._availablePlayers.find(
            (player) => player.entity_id === clientData.selectedPlayerId
          ) || this._availablePlayers[0];
        this.selectPlayer(newPlayer);
      }

      // Update currently played items
      this._playerState =
        this.hass && this._selectedPlayer
          ? this.hass.states[this._selectedPlayer.entity_id]
          : null;
      this._currentPlayingItemId = this._playerState && this._playerState.attributes.media_content_id
        ? decodeURI(this._playerState.attributes.media_content_id)
        : null;
    }
  }

  getCardSize() {
    return 3;
  }

  setConfig(config) {
    this.config = config;
  }

  select(item) {
    if (isDirectory(item)) {
      this._currentPath.push(item.media_content_id);
      updateClientData({ currentPath: this._currentPath });
      this.loadCurrentDirectory();
    } else {
      this.playItem(item);
    }
  }

  back() {
    if (this._currentPath.length <= 0) return;

    this._currentPath.pop();
    updateClientData({ currentPath: this._currentPath });
    this.loadCurrentDirectory();
  }

  selectPlayer(player) {
    this._selectedPlayer = player;
    updateClientData({
      selectedPlayerId: player ? player.entity_id : undefined,
    });
  }

  async loadCurrentDirectory() {
    const directoryId =
      this._currentPath[this._currentPath.length - 1] || undefined;
    this._currentDirectoryItem = await browseMedia(this.hass, directoryId);
  }

  async playItem(item) {
    if (!this._selectedPlayer) return;

    if (this._selectedPlayer.entity_id === BROWSER_PLAYER.entity_id) {
      await playMediaInBrowser(this.hass, item);
    } else {
      await playMedia(this.hass, this._selectedPlayer.entity_id, item);
    }

    if (!clientData.playedItemIds.includes(item.media_content_id)) {
      updateClientData({
        playedItemIds: [...clientData.playedItemIds, item.media_content_id],
      });
    }
  }

  openMenu() {
    this._menuOpened = true;

    setTimeout(() => {
      document.addEventListener("click", this.closeMenu.bind(this), {
        once: true,
      });
    });
  }

  closeMenu() {
    this._menuOpened = false;
  }

  jumpToLastPlayed() {
    const fileRows = this.shadowRoot.querySelectorAll("tr");
    const lastPlayed = Array.from(fileRows)
      .reverse()
      .find((row) => clientData.playedItemIds.includes(row.dataset.contentId));

    if (lastPlayed) {
      lastPlayed.scrollIntoView();
    }
  }

  clearPlayedItems() {
    updateClientData({
      playedItemIds: [],
    });
  }

  handleSeekBackward() {
    if (!this._currentPlayingItemId) {
      return;
    }
    this._seekDelta -= 30;
    this.debouncedSeek();
  }

  handleSeekForward() {
    if (!this._currentPlayingItemId) {
      return;
    }
    this._seekDelta += 30;
    this.debouncedSeek();
  }

  debouncedSeek() {
    if (this._seekTimeout) {
      clearTimeout(this._seekTimeout);
    }
    this._seekTimeout = window.setTimeout(() => this.executeSeek(), 1500);
  }

  executeSeek() {
    const currentPosition = getCurrentProgress(this._playerState);
    let newPosition = currentPosition + this._seekDelta;
    newPosition = Math.min(
      newPosition,
      this._playerState.attributes.media_duration
    );
    newPosition = Math.max(newPosition, 0);

    this.hass.callService("media_player", "media_seek", {
      entity_id: this._selectedPlayer.entity_id,
      seek_position: newPosition,
    });
    this._seekDelta = 0;
    this._seekTimeout = undefined;
  }

  formatSeekDelta() {
    const prefixSign = this._seekDelta > 0 ? "+" : "-";
    const absoluteDelta = Math.abs(this._seekDelta);
    const minutes = Math.floor(absoluteDelta / 60);
    const seconds = absoluteDelta % 60;

    return `${prefixSign}${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  render() {
    const children =
      (this._currentDirectoryItem && this._currentDirectoryItem.children) || [];
    const hasChildren = children.length > 0;

    return html`
      <div
        class="h-full flex flex-col divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 dark:divide-gray-700"
      >
        <div class="flex flex-col p-4 gap-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">Media Browser</h3>
            <div>${this.renderPlayerSelect()}</div>
          </div>
          ${this._currentPath.length > 0
            ? html`
                <div class="flex justify-between">
                  <button
                    type="button"
                    class="rounded bg-white px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500 dark:hover:bg-gray-600"
                    @click="${this.back}"
                  >
                    Back
                  </button>
                  <div class="flex gap-2 items-center">
                    ${this.renderSeekControls()} ${this.renderMenu()}
                  </div>
                </div>
              `
            : null}
        </div>
        <div class="flex-1 overflow-y-auto">
          ${hasChildren
            ? this.renderFileList(children)
            : this.renderEmptyHint()}
        </div>
      </div>
    `;
  }

  renderPlayerSelect() {
    if (!this._availablePlayers.length) return null;

    const selectedPlayerId = this._selectedPlayer
      ? this._selectedPlayer.entity_id
      : null;
    const options = this._availablePlayers.map((player) => {
      const displayName = player.attributes.friendly_name || player.entity_id;
      return html`
        <option
          value="${player.entity_id}"
          ?selected="${player.entity_id === selectedPlayerId}"
        >
          ${displayName}
        </option>
      `;
    });

    return html`
      <select
        class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 text-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500"
        @change="${(event) =>
          this.selectPlayer(
            this._availablePlayers.find(
              (player) => player.entity_id === event.target.value
            )
          )}"
      >
        ${options}
      </select>
    `;
  }

  renderSeekControls() {
    if (!this._currentPlayingItemId) {
      return null;
    }
    return html`
      ${this._seekDelta
        ? html`<span class="text-sm">${this.formatSeekDelta()}</span>`
        : ""}
      <button
        type="button"
        class="rounded bg-white px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500 dark:hover:bg-gray-600"
        @click="${this.handleSeekBackward}"
      >
        -30s
      </button>
      <button
        type="button"
        class="rounded bg-white px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500 dark:hover:bg-gray-600"
        @click="${this.handleSeekForward}"
      >
        +30s
      </button>
    `;
  }

  renderMenu() {
    return html`
      <div class="self-stretch relative inline-block text-left">
        <div>
          <button
            type="button"
            class="inline-flex w-full justify-center gap-x-1.5 rounded bg-white px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500 dark:hover:bg-gray-600"
            id="menu-button"
            aria-expanded="true"
            aria-haspopup="true"
            @click="${this.openMenu}"
          >
            ...
          </button>
        </div>

        ${this._menuOpened
          ? html`
              <div
                class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-700 dark:ring-gray-600"
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="menu-button"
                tabindex="-1"
              >
                <div class="py-1" role="none">
                  <button
                    class="w-full block text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-600"
                    role="menuitem"
                    id="menu-item-0"
                    @click="${this.jumpToLastPlayed}"
                  >
                    Jump to last played
                  </button>
                  <button
                    class="w-full block text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-600"
                    role="menuitem"
                    id="menu-item-0"
                    @click="${this.clearPlayedItems}"
                  >
                    Clear played items
                  </button>
                </div>
              </div>
            `
          : null}
      </div>
    `;
  }

  renderEmptyHint() {
    return html` <div class="p-4">No files found.</div> `;
  }

  renderFileList(items) {
    const rows = items.map((item) => {
      const icon = isDirectory(item) ? folderIcon : fileIcon;
      const isPlaying =
        !isDirectory(item) &&
        this._currentPlayingItemId &&
        (this._currentPlayingItemId === item.media_content_id ||
          this._currentPlayingItemId.indexOf(item.title) >= 0);
      const hasBeenPlayed = clientData.playedItemIds.includes(
        item.media_content_id
      );
      const itemClass = isPlaying
        ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700"
        : hasBeenPlayed
        ? "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        : "text-gray-900 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700";

      return html`
        <tr
          class="${itemClass}"
          @click="${() => this.select(item)}"
          data-content-id=${item.media_content_id}
        >
          <td class="pl-4 py-3.5">${icon}</td>
          <td class="w-full px-4 py-3.5 text-left text-sm font-semibold">
            ${item.title}
          </td>
        </tr>
      `;
    });

    return html` <table class="min-w-full">
      <tbody
        class="divide-y divide-gray-200 bg-white dark:bg-gray-800 dark:divide-gray-700"
      >
        ${rows}
      </tbody>
    </table>`;
  }
}

customElements.define("media-browser-card", MediaBrowserCard);
