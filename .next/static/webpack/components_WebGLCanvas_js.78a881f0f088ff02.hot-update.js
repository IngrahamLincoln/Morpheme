"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("components_WebGLCanvas_js",{

/***/ "./components/ConnectorMaterial.js":
/*!*****************************************!*\
  !*** ./components/ConnectorMaterial.js ***!
  \*****************************************/
/***/ (function(module, __webpack_exports__, __webpack_require__) {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   ConnectorMaterial: function() { return /* binding */ ConnectorMaterial; }\n/* harmony export */ });\n/* harmony import */ var three__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! three */ \"./node_modules/three/build/three.module.js\");\n/* harmony import */ var _react_three_drei__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @react-three/drei */ \"./node_modules/@react-three/drei/index.js\");\n\n\n// Define uniforms and shader code\n// Simplified version - just one circle\nconst ConnectorMaterial = (0,_react_three_drei__WEBPACK_IMPORTED_MODULE_0__.shaderMaterial)(// Uniforms (inputs to the shader)\n{\n    u_radiusB: 0.4,\n    u_radiusA: 0.5,\n    u_spacing: 1.5,\n    u_center1: new three__WEBPACK_IMPORTED_MODULE_1__.Vector2(0, 0),\n    u_center2: new three__WEBPACK_IMPORTED_MODULE_1__.Vector2(0, 0),\n    u_resolution: new three__WEBPACK_IMPORTED_MODULE_1__.Vector2(1, 1)\n}, \"\\n    varying vec2 vUv;\\n    varying vec2 vWorldPos; // Pass world position\\n\\n    void main() {\\n      vUv = uv;\\n      // Calculate world position (assuming plane is at z=0)\\n      vec4 worldPos = modelMatrix * vec4(position, 1.0);\\n      vWorldPos = worldPos.xy;\\n      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n    }\\n  \", \"\\n    varying vec2 vUv;\\n    varying vec2 vWorldPos;\\n\\n    uniform float u_radiusB;\\n    uniform float u_radiusA;\\n    uniform float u_spacing;\\n    uniform vec2 u_center1;\\n    uniform vec2 u_center2;\\n    uniform vec2 u_resolution;\\n\\n    void main() {\\n      // Get the pixel's world position\\n      vec2 p = vWorldPos;\\n\\n      // Calculate distance to center\\n      float dist = length(p);\\n      \\n      // Signed distance field for circle (negative inside, positive outside)\\n      float circleSDF = dist - u_radiusB;\\n      \\n      // Anti-aliased circle edge\\n      float edgeWidth = 0.01;\\n      float alpha = 1.0 - smoothstep(-edgeWidth, edgeWidth, circleSDF);\\n      \\n      // If nearly transparent, discard the pixel\\n      if (alpha < 0.01) discard;\\n      \\n      // Output black circle with calculated alpha\\n      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\\n    }\\n  \");\n// Add a unique key for HMR purposes with R3F\nConnectorMaterial.key = three__WEBPACK_IMPORTED_MODULE_1__.MathUtils.generateUUID();\n\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9jb21wb25lbnRzL0Nvbm5lY3Rvck1hdGVyaWFsLmpzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUErQjtBQUNvQjtBQUVuRCxrQ0FBa0M7QUFDbEMsdUNBQXVDO0FBRXZDLE1BQU1FLG9CQUFvQkQsaUVBQWNBLENBQ3RDLGtDQUFrQztBQUNsQztJQUNFRSxXQUFXO0lBQ1hDLFdBQVc7SUFDWEMsV0FBVztJQUNYQyxXQUFXLElBQUlOLDBDQUFhLENBQUMsR0FBRztJQUNoQ1EsV0FBVyxJQUFJUiwwQ0FBYSxDQUFDLEdBQUc7SUFDaENTLGNBQWMsSUFBSVQsMENBQWEsQ0FBQyxHQUFHO0FBQ3JDLEdBRVMsdVdBYUE7QUFrQ1gsNkNBQTZDO0FBQzdDRSxrQkFBa0JRLEdBQUcsR0FBR1YsNENBQWUsQ0FBQ1ksWUFBWTtBQUV2QiIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi9jb21wb25lbnRzL0Nvbm5lY3Rvck1hdGVyaWFsLmpzPzQxNDIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgc2hhZGVyTWF0ZXJpYWwgfSBmcm9tICdAcmVhY3QtdGhyZWUvZHJlaSc7XG5cbi8vIERlZmluZSB1bmlmb3JtcyBhbmQgc2hhZGVyIGNvZGVcbi8vIFNpbXBsaWZpZWQgdmVyc2lvbiAtIGp1c3Qgb25lIGNpcmNsZVxuXG5jb25zdCBDb25uZWN0b3JNYXRlcmlhbCA9IHNoYWRlck1hdGVyaWFsKFxuICAvLyBVbmlmb3JtcyAoaW5wdXRzIHRvIHRoZSBzaGFkZXIpXG4gIHtcbiAgICB1X3JhZGl1c0I6IDAuNCxcbiAgICB1X3JhZGl1c0E6IDAuNSxcbiAgICB1X3NwYWNpbmc6IDEuNSxcbiAgICB1X2NlbnRlcjE6IG5ldyBUSFJFRS5WZWN0b3IyKDAsIDApLCAvLyBXaWxsIGJlIHVwZGF0ZWRcbiAgICB1X2NlbnRlcjI6IG5ldyBUSFJFRS5WZWN0b3IyKDAsIDApLCAvLyBXaWxsIGJlIHVwZGF0ZWRcbiAgICB1X3Jlc29sdXRpb246IG5ldyBUSFJFRS5WZWN0b3IyKDEsIDEpLCAvLyBPcHRpb25hbDogc2NyZWVuIHJlc29sdXRpb24gaWYgbmVlZGVkXG4gIH0sXG4gIC8vIFZlcnRleCBTaGFkZXIgKHVzdWFsbHkgc2ltcGxlIGZvciAyRCBwbGFuZXMpXG4gIC8qZ2xzbCovYFxuICAgIHZhcnlpbmcgdmVjMiB2VXY7XG4gICAgdmFyeWluZyB2ZWMyIHZXb3JsZFBvczsgLy8gUGFzcyB3b3JsZCBwb3NpdGlvblxuXG4gICAgdm9pZCBtYWluKCkge1xuICAgICAgdlV2ID0gdXY7XG4gICAgICAvLyBDYWxjdWxhdGUgd29ybGQgcG9zaXRpb24gKGFzc3VtaW5nIHBsYW5lIGlzIGF0IHo9MClcbiAgICAgIHZlYzQgd29ybGRQb3MgPSBtb2RlbE1hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7XG4gICAgICB2V29ybGRQb3MgPSB3b3JsZFBvcy54eTtcbiAgICAgIGdsX1Bvc2l0aW9uID0gcHJvamVjdGlvbk1hdHJpeCAqIG1vZGVsVmlld01hdHJpeCAqIHZlYzQocG9zaXRpb24sIDEuMCk7XG4gICAgfVxuICBgLFxuICAvLyBGcmFnbWVudCBTaGFkZXIgLSBzaW1wbGlmaWVkIHRvIGp1c3Qgb25lIGNpcmNsZVxuICAvKmdsc2wqL2BcbiAgICB2YXJ5aW5nIHZlYzIgdlV2O1xuICAgIHZhcnlpbmcgdmVjMiB2V29ybGRQb3M7XG5cbiAgICB1bmlmb3JtIGZsb2F0IHVfcmFkaXVzQjtcbiAgICB1bmlmb3JtIGZsb2F0IHVfcmFkaXVzQTtcbiAgICB1bmlmb3JtIGZsb2F0IHVfc3BhY2luZztcbiAgICB1bmlmb3JtIHZlYzIgdV9jZW50ZXIxO1xuICAgIHVuaWZvcm0gdmVjMiB1X2NlbnRlcjI7XG4gICAgdW5pZm9ybSB2ZWMyIHVfcmVzb2x1dGlvbjtcblxuICAgIHZvaWQgbWFpbigpIHtcbiAgICAgIC8vIEdldCB0aGUgcGl4ZWwncyB3b3JsZCBwb3NpdGlvblxuICAgICAgdmVjMiBwID0gdldvcmxkUG9zO1xuXG4gICAgICAvLyBDYWxjdWxhdGUgZGlzdGFuY2UgdG8gY2VudGVyXG4gICAgICBmbG9hdCBkaXN0ID0gbGVuZ3RoKHApO1xuICAgICAgXG4gICAgICAvLyBTaWduZWQgZGlzdGFuY2UgZmllbGQgZm9yIGNpcmNsZSAobmVnYXRpdmUgaW5zaWRlLCBwb3NpdGl2ZSBvdXRzaWRlKVxuICAgICAgZmxvYXQgY2lyY2xlU0RGID0gZGlzdCAtIHVfcmFkaXVzQjtcbiAgICAgIFxuICAgICAgLy8gQW50aS1hbGlhc2VkIGNpcmNsZSBlZGdlXG4gICAgICBmbG9hdCBlZGdlV2lkdGggPSAwLjAxO1xuICAgICAgZmxvYXQgYWxwaGEgPSAxLjAgLSBzbW9vdGhzdGVwKC1lZGdlV2lkdGgsIGVkZ2VXaWR0aCwgY2lyY2xlU0RGKTtcbiAgICAgIFxuICAgICAgLy8gSWYgbmVhcmx5IHRyYW5zcGFyZW50LCBkaXNjYXJkIHRoZSBwaXhlbFxuICAgICAgaWYgKGFscGhhIDwgMC4wMSkgZGlzY2FyZDtcbiAgICAgIFxuICAgICAgLy8gT3V0cHV0IGJsYWNrIGNpcmNsZSB3aXRoIGNhbGN1bGF0ZWQgYWxwaGFcbiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMS4wKTtcbiAgICB9XG4gIGBcbik7XG5cbi8vIEFkZCBhIHVuaXF1ZSBrZXkgZm9yIEhNUiBwdXJwb3NlcyB3aXRoIFIzRlxuQ29ubmVjdG9yTWF0ZXJpYWwua2V5ID0gVEhSRUUuTWF0aFV0aWxzLmdlbmVyYXRlVVVJRCgpO1xuXG5leHBvcnQgeyBDb25uZWN0b3JNYXRlcmlhbCB9OyAiXSwibmFtZXMiOlsiVEhSRUUiLCJzaGFkZXJNYXRlcmlhbCIsIkNvbm5lY3Rvck1hdGVyaWFsIiwidV9yYWRpdXNCIiwidV9yYWRpdXNBIiwidV9zcGFjaW5nIiwidV9jZW50ZXIxIiwiVmVjdG9yMiIsInVfY2VudGVyMiIsInVfcmVzb2x1dGlvbiIsImtleSIsIk1hdGhVdGlscyIsImdlbmVyYXRlVVVJRCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./components/ConnectorMaterial.js\n"));

/***/ })

});