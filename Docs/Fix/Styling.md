### Styling update

Currently, the plugin's right panel stlyling is pretty bland. make it look good. The styles should be stored in a typescript style registry and store it in `/src/lib/styles/right-panel-styles.ts`. The registry should consist of classname and style pairs. The styling of all elements created in `/src/lib/geolibre/right-panel.ts` should use the styling in the registry. When modifying the styles, make sure that:
1. Dropdowns have a border
2. Dropdown options must have a white background and black text
3. Input fields have a border
4. Buttons (Processing and file upload) have a border
5. The type of element doesn't change (dropdowns stays dropdown, sliders stays slider)
6. Any right panel styling dependent on `/src/lib/styles/plugin-control.css` is also ported to the registry

### Some Recommended Stylings

- Panel: white or near-white background, dark text, `boxSizing: "border-box"`,
  `padding: "16px"`, and a neutral border/shadow.
- Form: `display: "flex"`, `flexDirection: "column"`, and a small consistent
  `gap`.
- Controls: `width: "100%"`, `minHeight: "36px"`, readable padding, and
  `border: "1px solid #b8c1cc"`.
- Selects: `backgroundColor: "#ffffff"`, `color: "#111827"`, and the same
  visible border as other controls.
- Options: `backgroundColor: "#ffffff"` and `color: "#000000"` explicitly.
- Buttons: a contrasting accent background, white text, and an explicit
  border such as `"1px solid #1d4ed8"`; include hover and focus behavior only
  if it can remain inside the same registry model.