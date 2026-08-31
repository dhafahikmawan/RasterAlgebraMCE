### Fix and Update List 03

### Update
1. Update how the styling is indexed. Change the class names of the HTML Elements to these  (and update the style registry so that it is based on these classes instead):
    - For the dropdowns, `spazio-dropdown`.
    - For the dropdown options, `spazio-dropdown-options`.
    - For the calculator expression fields (if any), `spazio-expression-field`.
    - For the calculator buttons (if any), `spazio-calculator-button`.
    - For the input text/numeric fields, `spazio-text-field`.
    - For the input file fields, `spazio-file-field`.
    - For checkboxes (if any), `spazio-checkbox`.
    - For the sliders (if any), `spazio-slider`.
    - For the labels of the fields, dropdowns, checkboxes, sliders (basically input fields), `spazio-input-label`.
    - Input field descriptions (if any): `spazio-input-description`.
    - For AHP table (if any), `spazio-ahp-table`.
    - For AHP table fields (if any), `spazio-ahp-field`.
    - For AHP table Raster Indexes (e.g, Raster 1, Raster 2, ... (basically row 1 and col 1)) (if any), `spazio-ahp-headers`.
    - For status fields, `spazio-status`.
    - For the main container, `spazio-container`.
    - For the submit/processing buttons, `spazio-submit-button`.
    - For other buttons, `spazio-button`.
    - For the title of the plugin (`heading` variable in right panel), `spazio-title`.
    - For the description of the plugin (`body` variable in right panel, currently empty), `spazio-description`.
    - For anything else, prefix the class name with `spazio-`.
For the classes explicitly named in this list, even if it is not used in the plugin, make sure that it is added to the registry, and leave the style empty.
2. Currently, the AHP interface in MCE isn't very intuitive in showing which field can or can't be edited. Maybe grey out the uneditable fields.
3. In MCE and Raster Algebra, Add another field in the form after the raster uploads, which is going to be a dropdown in which the user can select which raster to be used as the bounding box. The default is the raster uploaded in the first field for MCE, and the leftmost operand for raster algebra. This dropdown resets everytime the number of rasters or the uploaded rasters are changed.



