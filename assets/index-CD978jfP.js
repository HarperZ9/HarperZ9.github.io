var e=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports);(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var t=`modulepreload`,n=function(e){return`/`+e},r={};(function(e,i,a){let o=Promise.resolve();if(i&&i.length>0){let e=document.getElementsByTagName(`link`),s=document.querySelector(`meta[property=csp-nonce]`),c=s?.nonce||s?.getAttribute(`nonce`);function l(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function u(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,new URL(`../../../src/node/plugins/importAnalysisBuild.ts`,import.meta.url)).href}o=l(i.map(i=>{if(i=n(i,a),i=u(i),i in r)return;r[i]=!0;let o=i.endsWith(`.css`);for(let t=e.length-1;t>=0;t--){let n=e[t];if(n.href===i&&(!o||n.rel===`stylesheet`))return}let s=document.createElement(`link`);if(s.rel=o?`stylesheet`:t,o||(s.as=`script`),s.crossOrigin=``,s.href=i,c&&s.setAttribute(`nonce`,c),document.head.appendChild(s),o)return new Promise((e,t)=>{s.addEventListener(`load`,e),s.addEventListener(`error`,()=>t(Error(`Unable to preload CSS for ${i}`)))})}))}function s(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return o.then(t=>{for(let e of t||[])e.status===`rejected`&&s(e.reason);return e().catch(s)})})(()=>import(`/system/home-art.js?v=20260828-site-design`),[]);var i=e((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.portal`),r=Symbol.for(`react.fragment`),i=Symbol.for(`react.strict_mode`),a=Symbol.for(`react.profiler`),o=Symbol.for(`react.consumer`),s=Symbol.for(`react.context`),c=Symbol.for(`react.forward_ref`),l=Symbol.for(`react.suspense`),u=Symbol.for(`react.memo`),d=Symbol.for(`react.lazy`),f=Symbol.for(`react.activity`),p=Symbol.iterator;function m(e){return typeof e!=`object`||!e?null:(e=p&&e[p]||e[`@@iterator`],typeof e==`function`?e:null)}var h={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},g=Object.assign,_={};function v(e,t,n){this.props=e,this.context=t,this.refs=_,this.updater=n||h}v.prototype.isReactComponent={},v.prototype.setState=function(e,t){if(typeof e!=`object`&&typeof e!=`function`&&e!=null)throw Error(`takes an object of state variables to update or a function which returns an object of state variables.`);this.updater.enqueueSetState(this,e,t,`setState`)},v.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,`forceUpdate`)};function y(){}y.prototype=v.prototype;function b(e,t,n){this.props=e,this.context=t,this.refs=_,this.updater=n||h}var x=b.prototype=new y;x.constructor=b,g(x,v.prototype),x.isPureReactComponent=!0;var ee=Array.isArray;function S(){}var C={H:null,A:null,T:null,S:null},te=Object.prototype.hasOwnProperty;function ne(e,n,r){var i=r.ref;return{$$typeof:t,type:e,key:n,ref:i===void 0?null:i,props:r}}function re(e,t){return ne(e.type,t,e.props)}function w(e){return typeof e==`object`&&!!e&&e.$$typeof===t}function ie(e){var t={"=":`=0`,":":`=2`};return`$`+e.replace(/[=:]/g,function(e){return t[e]})}var ae=/\/+/g;function oe(e,t){return typeof e==`object`&&e&&e.key!=null?ie(``+e.key):t.toString(36)}function se(e){switch(e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason;default:switch(typeof e.status==`string`?e.then(S,S):(e.status=`pending`,e.then(function(t){e.status===`pending`&&(e.status=`fulfilled`,e.value=t)},function(t){e.status===`pending`&&(e.status=`rejected`,e.reason=t)})),e.status){case`fulfilled`:return e.value;case`rejected`:throw e.reason}}throw e}function ce(e,r,i,a,o){var s=typeof e;(s===`undefined`||s===`boolean`)&&(e=null);var c=!1;if(e===null)c=!0;else switch(s){case`bigint`:case`string`:case`number`:c=!0;break;case`object`:switch(e.$$typeof){case t:case n:c=!0;break;case d:return c=e._init,ce(c(e._payload),r,i,a,o)}}if(c)return o=o(e),c=a===``?`.`+oe(e,0):a,ee(o)?(i=``,c!=null&&(i=c.replace(ae,`$&/`)+`/`),ce(o,r,i,``,function(e){return e})):o!=null&&(w(o)&&(o=re(o,i+(o.key==null||e&&e.key===o.key?``:(``+o.key).replace(ae,`$&/`)+`/`)+c)),r.push(o)),1;c=0;var l=a===``?`.`:a+`:`;if(ee(e))for(var u=0;u<e.length;u++)a=e[u],s=l+oe(a,u),c+=ce(a,r,i,s,o);else if(u=m(e),typeof u==`function`)for(e=u.call(e),u=0;!(a=e.next()).done;)a=a.value,s=l+oe(a,u++),c+=ce(a,r,i,s,o);else if(s===`object`){if(typeof e.then==`function`)return ce(se(e),r,i,a,o);throw r=String(e),Error(`Objects are not valid as a React child (found: `+(r===`[object Object]`?`object with keys {`+Object.keys(e).join(`, `)+`}`:r)+`). If you meant to render a collection of children, use an array instead.`)}return c}function le(e,t,n){if(e==null)return e;var r=[],i=0;return ce(e,r,``,``,function(e){return t.call(n,e,i++)}),r}function ue(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(t){(e._status===0||e._status===-1)&&(e._status=1,e._result=t)},function(t){(e._status===0||e._status===-1)&&(e._status=2,e._result=t)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var T=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)},E={map:le,forEach:function(e,t,n){le(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return le(e,function(){t++}),t},toArray:function(e){return le(e,function(e){return e})||[]},only:function(e){if(!w(e))throw Error(`React.Children.only expected to receive a single React element child.`);return e}};e.Activity=f,e.Children=E,e.Component=v,e.Fragment=r,e.Profiler=a,e.PureComponent=b,e.StrictMode=i,e.Suspense=l,e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=C,e.__COMPILER_RUNTIME={__proto__:null,c:function(e){return C.H.useMemoCache(e)}},e.cache=function(e){return function(){return e.apply(null,arguments)}},e.cacheSignal=function(){return null},e.cloneElement=function(e,t,n){if(e==null)throw Error(`The argument must be a React element, but you passed `+e+`.`);var r=g({},e.props),i=e.key;if(t!=null)for(a in t.key!==void 0&&(i=``+t.key),t)!te.call(t,a)||a===`key`||a===`__self`||a===`__source`||a===`ref`&&t.ref===void 0||(r[a]=t[a]);var a=arguments.length-2;if(a===1)r.children=n;else if(1<a){for(var o=Array(a),s=0;s<a;s++)o[s]=arguments[s+2];r.children=o}return ne(e.type,i,r)},e.createContext=function(e){return e={$$typeof:s,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null},e.Provider=e,e.Consumer={$$typeof:o,_context:e},e},e.createElement=function(e,t,n){var r,i={},a=null;if(t!=null)for(r in t.key!==void 0&&(a=``+t.key),t)te.call(t,r)&&r!==`key`&&r!==`__self`&&r!==`__source`&&(i[r]=t[r]);var o=arguments.length-2;if(o===1)i.children=n;else if(1<o){for(var s=Array(o),c=0;c<o;c++)s[c]=arguments[c+2];i.children=s}if(e&&e.defaultProps)for(r in o=e.defaultProps,o)i[r]===void 0&&(i[r]=o[r]);return ne(e,a,i)},e.createRef=function(){return{current:null}},e.forwardRef=function(e){return{$$typeof:c,render:e}},e.isValidElement=w,e.lazy=function(e){return{$$typeof:d,_payload:{_status:-1,_result:e},_init:ue}},e.memo=function(e,t){return{$$typeof:u,type:e,compare:t===void 0?null:t}},e.startTransition=function(e){var t=C.T,n={};C.T=n;try{var r=e(),i=C.S;i!==null&&i(n,r),typeof r==`object`&&r&&typeof r.then==`function`&&r.then(S,T)}catch(e){T(e)}finally{t!==null&&n.types!==null&&(t.types=n.types),C.T=t}},e.unstable_useCacheRefresh=function(){return C.H.useCacheRefresh()},e.use=function(e){return C.H.use(e)},e.useActionState=function(e,t,n){return C.H.useActionState(e,t,n)},e.useCallback=function(e,t){return C.H.useCallback(e,t)},e.useContext=function(e){return C.H.useContext(e)},e.useDebugValue=function(){},e.useDeferredValue=function(e,t){return C.H.useDeferredValue(e,t)},e.useEffect=function(e,t){return C.H.useEffect(e,t)},e.useEffectEvent=function(e){return C.H.useEffectEvent(e)},e.useId=function(){return C.H.useId()},e.useImperativeHandle=function(e,t,n){return C.H.useImperativeHandle(e,t,n)},e.useInsertionEffect=function(e,t){return C.H.useInsertionEffect(e,t)},e.useLayoutEffect=function(e,t){return C.H.useLayoutEffect(e,t)},e.useMemo=function(e,t){return C.H.useMemo(e,t)},e.useOptimistic=function(e,t){return C.H.useOptimistic(e,t)},e.useReducer=function(e,t,n){return C.H.useReducer(e,t,n)},e.useRef=function(e){return C.H.useRef(e)},e.useState=function(e){return C.H.useState(e)},e.useSyncExternalStore=function(e,t,n){return C.H.useSyncExternalStore(e,t,n)},e.useTransition=function(){return C.H.useTransition()},e.version=`19.2.7`})),a=e(((e,t)=>{t.exports=i()})),o=e((e=>{function t(e,t){var n=e.length;e.push(t);a:for(;0<n;){var r=n-1>>>1,a=e[r];if(0<i(a,t))e[r]=t,e[n]=a,n=r;else break a}}function n(e){return e.length===0?null:e[0]}function r(e){if(e.length===0)return null;var t=e[0],n=e.pop();if(n!==t){e[0]=n;a:for(var r=0,a=e.length,o=a>>>1;r<o;){var s=2*(r+1)-1,c=e[s],l=s+1,u=e[l];if(0>i(c,n))l<a&&0>i(u,c)?(e[r]=u,e[l]=n,r=l):(e[r]=c,e[s]=n,r=s);else if(l<a&&0>i(u,n))e[r]=u,e[l]=n,r=l;else break a}}return t}function i(e,t){var n=e.sortIndex-t.sortIndex;return n===0?e.id-t.id:n}if(e.unstable_now=void 0,typeof performance==`object`&&typeof performance.now==`function`){var a=performance;e.unstable_now=function(){return a.now()}}else{var o=Date,s=o.now();e.unstable_now=function(){return o.now()-s}}var c=[],l=[],u=1,d=null,f=3,p=!1,m=!1,h=!1,g=!1,_=typeof setTimeout==`function`?setTimeout:null,v=typeof clearTimeout==`function`?clearTimeout:null,y=typeof setImmediate<`u`?setImmediate:null;function b(e){for(var i=n(l);i!==null;){if(i.callback===null)r(l);else if(i.startTime<=e)r(l),i.sortIndex=i.expirationTime,t(c,i);else break;i=n(l)}}function x(e){if(h=!1,b(e),!m)if(n(c)!==null)m=!0,ee||(ee=!0,w());else{var t=n(l);t!==null&&oe(x,t.startTime-e)}}var ee=!1,S=-1,C=5,te=-1;function ne(){return g?!0:!(e.unstable_now()-te<C)}function re(){if(g=!1,ee){var t=e.unstable_now();te=t;var i=!0;try{a:{m=!1,h&&(h=!1,v(S),S=-1),p=!0;var a=f;try{b:{for(b(t),d=n(c);d!==null&&!(d.expirationTime>t&&ne());){var o=d.callback;if(typeof o==`function`){d.callback=null,f=d.priorityLevel;var s=o(d.expirationTime<=t);if(t=e.unstable_now(),typeof s==`function`){d.callback=s,b(t),i=!0;break b}d===n(c)&&r(c),b(t)}else r(c);d=n(c)}if(d!==null)i=!0;else{var u=n(l);u!==null&&oe(x,u.startTime-t),i=!1}}break a}finally{d=null,f=a,p=!1}i=void 0}}finally{i?w():ee=!1}}}var w;if(typeof y==`function`)w=function(){y(re)};else if(typeof MessageChannel<`u`){var ie=new MessageChannel,ae=ie.port2;ie.port1.onmessage=re,w=function(){ae.postMessage(null)}}else w=function(){_(re,0)};function oe(t,n){S=_(function(){t(e.unstable_now())},n)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(e){e.callback=null},e.unstable_forceFrameRate=function(e){0>e||125<e?console.error(`forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported`):C=0<e?Math.floor(1e3/e):5},e.unstable_getCurrentPriorityLevel=function(){return f},e.unstable_next=function(e){switch(f){case 1:case 2:case 3:var t=3;break;default:t=f}var n=f;f=t;try{return e()}finally{f=n}},e.unstable_requestPaint=function(){g=!0},e.unstable_runWithPriority=function(e,t){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var n=f;f=e;try{return t()}finally{f=n}},e.unstable_scheduleCallback=function(r,i,a){var o=e.unstable_now();switch(typeof a==`object`&&a?(a=a.delay,a=typeof a==`number`&&0<a?o+a:o):a=o,r){case 1:var s=-1;break;case 2:s=250;break;case 5:s=1073741823;break;case 4:s=1e4;break;default:s=5e3}return s=a+s,r={id:u++,callback:i,priorityLevel:r,startTime:a,expirationTime:s,sortIndex:-1},a>o?(r.sortIndex=a,t(l,r),n(c)===null&&r===n(l)&&(h?(v(S),S=-1):h=!0,oe(x,a-o))):(r.sortIndex=s,t(c,r),m||p||(m=!0,ee||(ee=!0,w()))),r},e.unstable_shouldYield=ne,e.unstable_wrapCallback=function(e){var t=f;return function(){var n=f;f=t;try{return e.apply(this,arguments)}finally{f=n}}}})),s=e(((e,t)=>{t.exports=o()})),c=e((e=>{var t=a();function n(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function r(){}var i={d:{f:r,r:function(){throw Error(n(522))},D:r,C:r,L:r,m:r,X:r,S:r,M:r},p:0,findDOMNode:null},o=Symbol.for(`react.portal`);function s(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:o,key:r==null?null:``+r,children:e,containerInfo:t,implementation:n}}var c=t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function l(e,t){if(e===`font`)return``;if(typeof t==`string`)return t===`use-credentials`?t:``}e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=i,e.createPortal=function(e,t){var r=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!t||t.nodeType!==1&&t.nodeType!==9&&t.nodeType!==11)throw Error(n(299));return s(e,t,null,r)},e.flushSync=function(e){var t=c.T,n=i.p;try{if(c.T=null,i.p=2,e)return e()}finally{c.T=t,i.p=n,i.d.f()}},e.preconnect=function(e,t){typeof e==`string`&&(t?(t=t.crossOrigin,t=typeof t==`string`?t===`use-credentials`?t:``:void 0):t=null,i.d.C(e,t))},e.prefetchDNS=function(e){typeof e==`string`&&i.d.D(e)},e.preinit=function(e,t){if(typeof e==`string`&&t&&typeof t.as==`string`){var n=t.as,r=l(n,t.crossOrigin),a=typeof t.integrity==`string`?t.integrity:void 0,o=typeof t.fetchPriority==`string`?t.fetchPriority:void 0;n===`style`?i.d.S(e,typeof t.precedence==`string`?t.precedence:void 0,{crossOrigin:r,integrity:a,fetchPriority:o}):n===`script`&&i.d.X(e,{crossOrigin:r,integrity:a,fetchPriority:o,nonce:typeof t.nonce==`string`?t.nonce:void 0})}},e.preinitModule=function(e,t){if(typeof e==`string`)if(typeof t==`object`&&t){if(t.as==null||t.as===`script`){var n=l(t.as,t.crossOrigin);i.d.M(e,{crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0})}}else t??i.d.M(e)},e.preload=function(e,t){if(typeof e==`string`&&typeof t==`object`&&t&&typeof t.as==`string`){var n=t.as,r=l(n,t.crossOrigin);i.d.L(e,n,{crossOrigin:r,integrity:typeof t.integrity==`string`?t.integrity:void 0,nonce:typeof t.nonce==`string`?t.nonce:void 0,type:typeof t.type==`string`?t.type:void 0,fetchPriority:typeof t.fetchPriority==`string`?t.fetchPriority:void 0,referrerPolicy:typeof t.referrerPolicy==`string`?t.referrerPolicy:void 0,imageSrcSet:typeof t.imageSrcSet==`string`?t.imageSrcSet:void 0,imageSizes:typeof t.imageSizes==`string`?t.imageSizes:void 0,media:typeof t.media==`string`?t.media:void 0})}},e.preloadModule=function(e,t){if(typeof e==`string`)if(t){var n=l(t.as,t.crossOrigin);i.d.m(e,{as:typeof t.as==`string`&&t.as!==`script`?t.as:void 0,crossOrigin:n,integrity:typeof t.integrity==`string`?t.integrity:void 0})}else i.d.m(e)},e.requestFormReset=function(e){i.d.r(e)},e.unstable_batchedUpdates=function(e,t){return e(t)},e.useFormState=function(e,t,n){return c.H.useFormState(e,t,n)},e.useFormStatus=function(){return c.H.useHostTransitionStatus()},e.version=`19.2.7`})),l=e(((e,t)=>{function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>`u`||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!=`function`))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=c()})),u=e((e=>{var t=s(),n=a(),r=l();function i(e){var t=`https://react.dev/errors/`+e;if(1<arguments.length){t+=`?args[]=`+encodeURIComponent(arguments[1]);for(var n=2;n<arguments.length;n++)t+=`&args[]=`+encodeURIComponent(arguments[n])}return`Minified React error #`+e+`; visit `+t+` for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`}function o(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function c(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,t.flags&4098&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function u(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function d(e){if(e.tag===31){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function f(e){if(c(e)!==e)throw Error(i(188))}function p(e){var t=e.alternate;if(!t){if(t=c(e),t===null)throw Error(i(188));return t===e?e:null}for(var n=e,r=t;;){var a=n.return;if(a===null)break;var o=a.alternate;if(o===null){if(r=a.return,r!==null){n=r;continue}break}if(a.child===o.child){for(o=a.child;o;){if(o===n)return f(a),e;if(o===r)return f(a),t;o=o.sibling}throw Error(i(188))}if(n.return!==r.return)n=a,r=o;else{for(var s=!1,l=a.child;l;){if(l===n){s=!0,n=a,r=o;break}if(l===r){s=!0,r=a,n=o;break}l=l.sibling}if(!s){for(l=o.child;l;){if(l===n){s=!0,n=o,r=a;break}if(l===r){s=!0,r=o,n=a;break}l=l.sibling}if(!s)throw Error(i(189))}}if(n.alternate!==r)throw Error(i(190))}if(n.tag!==3)throw Error(i(188));return n.stateNode.current===n?e:t}function m(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e;for(e=e.child;e!==null;){if(t=m(e),t!==null)return t;e=e.sibling}return null}var h=Object.assign,g=Symbol.for(`react.element`),_=Symbol.for(`react.transitional.element`),v=Symbol.for(`react.portal`),y=Symbol.for(`react.fragment`),b=Symbol.for(`react.strict_mode`),x=Symbol.for(`react.profiler`),ee=Symbol.for(`react.consumer`),S=Symbol.for(`react.context`),C=Symbol.for(`react.forward_ref`),te=Symbol.for(`react.suspense`),ne=Symbol.for(`react.suspense_list`),re=Symbol.for(`react.memo`),w=Symbol.for(`react.lazy`),ie=Symbol.for(`react.activity`),ae=Symbol.for(`react.memo_cache_sentinel`),oe=Symbol.iterator;function se(e){return typeof e!=`object`||!e?null:(e=oe&&e[oe]||e[`@@iterator`],typeof e==`function`?e:null)}var ce=Symbol.for(`react.client.reference`);function le(e){if(e==null)return null;if(typeof e==`function`)return e.$$typeof===ce?null:e.displayName||e.name||null;if(typeof e==`string`)return e;switch(e){case y:return`Fragment`;case x:return`Profiler`;case b:return`StrictMode`;case te:return`Suspense`;case ne:return`SuspenseList`;case ie:return`Activity`}if(typeof e==`object`)switch(e.$$typeof){case v:return`Portal`;case S:return e.displayName||`Context`;case ee:return(e._context.displayName||`Context`)+`.Consumer`;case C:var t=e.render;return e=e.displayName,e||=(e=t.displayName||t.name||``,e===``?`ForwardRef`:`ForwardRef(`+e+`)`),e;case re:return t=e.displayName||null,t===null?le(e.type)||`Memo`:t;case w:t=e._payload,e=e._init;try{return le(e(t))}catch{}}return null}var ue=Array.isArray,T=n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,E=r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,de={pending:!1,data:null,method:null,action:null},fe=[],D=-1;function pe(e){return{current:e}}function O(e){0>D||(e.current=fe[D],fe[D]=null,D--)}function k(e,t){D++,fe[D]=e.current,e.current=t}var me=pe(null),he=pe(null),ge=pe(null),_e=pe(null);function ve(e,t){switch(k(ge,t),k(he,e),k(me,null),t.nodeType){case 9:case 11:e=(e=t.documentElement)&&(e=e.namespaceURI)?Vd(e):0;break;default:if(e=t.tagName,t=t.namespaceURI)t=Vd(t),e=Hd(t,e);else switch(e){case`svg`:e=1;break;case`math`:e=2;break;default:e=0}}O(me),k(me,e)}function ye(){O(me),O(he),O(ge)}function be(e){e.memoizedState!==null&&k(_e,e);var t=me.current,n=Hd(t,e.type);t!==n&&(k(he,e),k(me,n))}function xe(e){he.current===e&&(O(me),O(he)),_e.current===e&&(O(_e),Qf._currentValue=de)}var Se,Ce;function we(e){if(Se===void 0)try{throw Error()}catch(e){var t=e.stack.trim().match(/\n( *(at )?)/);Se=t&&t[1]||``,Ce=-1<e.stack.indexOf(`
    at`)?` (<anonymous>)`:-1<e.stack.indexOf(`@`)?`@unknown:0:0`:``}return`
`+Se+e+Ce}var Te=!1;function Ee(e,t){if(!e||Te)return``;Te=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var r={DetermineComponentFrameRoot:function(){try{if(t){var n=function(){throw Error()};if(Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),typeof Reflect==`object`&&Reflect.construct){try{Reflect.construct(n,[])}catch(e){var r=e}Reflect.construct(e,[],n)}else{try{n.call()}catch(e){r=e}e.call(n.prototype)}}else{try{throw Error()}catch(e){r=e}(n=e())&&typeof n.catch==`function`&&n.catch(function(){})}}catch(e){if(e&&r&&typeof e.stack==`string`)return[e.stack,r.stack]}return[null,null]}};r.DetermineComponentFrameRoot.displayName=`DetermineComponentFrameRoot`;var i=Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot,`name`);i&&i.configurable&&Object.defineProperty(r.DetermineComponentFrameRoot,"name",{value:`DetermineComponentFrameRoot`});var a=r.DetermineComponentFrameRoot(),o=a[0],s=a[1];if(o&&s){var c=o.split(`
`),l=s.split(`
`);for(i=r=0;r<c.length&&!c[r].includes(`DetermineComponentFrameRoot`);)r++;for(;i<l.length&&!l[i].includes(`DetermineComponentFrameRoot`);)i++;if(r===c.length||i===l.length)for(r=c.length-1,i=l.length-1;1<=r&&0<=i&&c[r]!==l[i];)i--;for(;1<=r&&0<=i;r--,i--)if(c[r]!==l[i]){if(r!==1||i!==1)do if(r--,i--,0>i||c[r]!==l[i]){var u=`
`+c[r].replace(` at new `,` at `);return e.displayName&&u.includes(`<anonymous>`)&&(u=u.replace(`<anonymous>`,e.displayName)),u}while(1<=r&&0<=i);break}}}finally{Te=!1,Error.prepareStackTrace=n}return(n=e?e.displayName||e.name:``)?we(n):``}function De(e,t){switch(e.tag){case 26:case 27:case 5:return we(e.type);case 16:return we(`Lazy`);case 13:return e.child!==t&&t!==null?we(`Suspense Fallback`):we(`Suspense`);case 19:return we(`SuspenseList`);case 0:case 15:return Ee(e.type,!1);case 11:return Ee(e.type.render,!1);case 1:return Ee(e.type,!0);case 31:return we(`Activity`);default:return``}}function Oe(e){try{var t=``,n=null;do t+=De(e,n),n=e,e=e.return;while(e);return t}catch(e){return`
Error generating stack: `+e.message+`
`+e.stack}}var ke=Object.prototype.hasOwnProperty,Ae=t.unstable_scheduleCallback,je=t.unstable_cancelCallback,Me=t.unstable_shouldYield,Ne=t.unstable_requestPaint,Pe=t.unstable_now,Fe=t.unstable_getCurrentPriorityLevel,Ie=t.unstable_ImmediatePriority,Le=t.unstable_UserBlockingPriority,Re=t.unstable_NormalPriority,ze=t.unstable_LowPriority,Be=t.unstable_IdlePriority,Ve=t.log,He=t.unstable_setDisableYieldValue,Ue=null,We=null;function Ge(e){if(typeof Ve==`function`&&He(e),We&&typeof We.setStrictMode==`function`)try{We.setStrictMode(Ue,e)}catch{}}var Ke=Math.clz32?Math.clz32:Ye,qe=Math.log,Je=Math.LN2;function Ye(e){return e>>>=0,e===0?32:31-(qe(e)/Je|0)|0}var Xe=256,Ze=262144,Qe=4194304;function $e(e){var t=e&42;if(t!==0)return t;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function et(e,t,n){var r=e.pendingLanes;if(r===0)return 0;var i=0,a=e.suspendedLanes,o=e.pingedLanes;e=e.warmLanes;var s=r&134217727;return s===0?(s=r&~a,s===0?o===0?n||(n=r&~e,n!==0&&(i=$e(n))):i=$e(o):i=$e(s)):(r=s&~a,r===0?(o&=s,o===0?n||(n=s&~e,n!==0&&(i=$e(n))):i=$e(o)):i=$e(r)),i===0?0:t!==0&&t!==i&&(t&a)===0&&(a=i&-i,n=t&-t,a>=n||a===32&&n&4194048)?t:i}function tt(e,t){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&t)===0}function nt(e,t){switch(e){case 1:case 2:case 4:case 8:case 64:return t+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function rt(){var e=Qe;return Qe<<=1,!(Qe&62914560)&&(Qe=4194304),e}function it(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function at(e,t){e.pendingLanes|=t,t!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function ot(e,t,n,r,i,a){var o=e.pendingLanes;e.pendingLanes=n,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=n,e.entangledLanes&=n,e.errorRecoveryDisabledLanes&=n,e.shellSuspendCounter=0;var s=e.entanglements,c=e.expirationTimes,l=e.hiddenUpdates;for(n=o&~n;0<n;){var u=31-Ke(n),d=1<<u;s[u]=0,c[u]=-1;var f=l[u];if(f!==null)for(l[u]=null,u=0;u<f.length;u++){var p=f[u];p!==null&&(p.lane&=-536870913)}n&=~d}r!==0&&st(e,r,0),a!==0&&i===0&&e.tag!==0&&(e.suspendedLanes|=a&~(o&~t))}function st(e,t,n){e.pendingLanes|=t,e.suspendedLanes&=~t;var r=31-Ke(t);e.entangledLanes|=t,e.entanglements[r]=e.entanglements[r]|1073741824|n&261930}function ct(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-Ke(n),i=1<<r;i&t|e[r]&t&&(e[r]|=t),n&=~i}}function lt(e,t){var n=t&-t;return n=n&42?1:ut(n),(n&(e.suspendedLanes|t))===0?n:0}function ut(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function dt(e){return e&=-e,2<e?8<e?e&134217727?32:268435456:8:2}function ft(){var e=E.p;return e===0?(e=window.event,e===void 0?32:mp(e.type)):e}function pt(e,t){var n=E.p;try{return E.p=e,t()}finally{E.p=n}}var mt=Math.random().toString(36).slice(2),ht=`__reactFiber$`+mt,gt=`__reactProps$`+mt,_t=`__reactContainer$`+mt,vt=`__reactEvents$`+mt,yt=`__reactListeners$`+mt,bt=`__reactHandles$`+mt,xt=`__reactResources$`+mt,St=`__reactMarker$`+mt;function Ct(e){delete e[ht],delete e[gt],delete e[vt],delete e[yt],delete e[bt]}function wt(e){var t=e[ht];if(t)return t;for(var n=e.parentNode;n;){if(t=n[_t]||n[ht]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=df(e);e!==null;){if(n=e[ht])return n;e=df(e)}return t}e=n,n=e.parentNode}return null}function Tt(e){if(e=e[ht]||e[_t]){var t=e.tag;if(t===5||t===6||t===13||t===31||t===26||t===27||t===3)return e}return null}function Et(e){var t=e.tag;if(t===5||t===26||t===27||t===6)return e.stateNode;throw Error(i(33))}function Dt(e){var t=e[xt];return t||=e[xt]={hoistableStyles:new Map,hoistableScripts:new Map},t}function A(e){e[St]=!0}var Ot=new Set,kt={};function At(e,t){jt(e,t),jt(e+`Capture`,t)}function jt(e,t){for(kt[e]=t,e=0;e<t.length;e++)Ot.add(t[e])}var Mt=RegExp(`^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`),Nt={},Pt={};function Ft(e){return ke.call(Pt,e)?!0:ke.call(Nt,e)?!1:Mt.test(e)?Pt[e]=!0:(Nt[e]=!0,!1)}function It(e,t,n){if(Ft(t))if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:e.removeAttribute(t);return;case`boolean`:var r=t.toLowerCase().slice(0,5);if(r!==`data-`&&r!==`aria-`){e.removeAttribute(t);return}}e.setAttribute(t,``+n)}}function Lt(e,t,n){if(n===null)e.removeAttribute(t);else{switch(typeof n){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(t);return}e.setAttribute(t,``+n)}}function Rt(e,t,n,r){if(r===null)e.removeAttribute(n);else{switch(typeof r){case`undefined`:case`function`:case`symbol`:case`boolean`:e.removeAttribute(n);return}e.setAttributeNS(t,n,``+r)}}function zt(e){switch(typeof e){case`bigint`:case`boolean`:case`number`:case`string`:case`undefined`:return e;case`object`:return e;default:return``}}function Bt(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()===`input`&&(t===`checkbox`||t===`radio`)}function Vt(e,t,n){var r=Object.getOwnPropertyDescriptor(e.constructor.prototype,t);if(!e.hasOwnProperty(t)&&r!==void 0&&typeof r.get==`function`&&typeof r.set==`function`){var i=r.get,a=r.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return i.call(this)},set:function(e){n=``+e,a.call(this,e)}}),Object.defineProperty(e,t,{enumerable:r.enumerable}),{getValue:function(){return n},setValue:function(e){n=``+e},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function Ht(e){if(!e._valueTracker){var t=Bt(e)?`checked`:`value`;e._valueTracker=Vt(e,t,``+e[t])}}function Ut(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r=``;return e&&(r=Bt(e)?e.checked?`true`:`false`:e.value),e=r,e===n?!1:(t.setValue(e),!0)}function Wt(e){if(e||=typeof document<`u`?document:void 0,e===void 0)return null;try{return e.activeElement||e.body}catch{return e.body}}var Gt=/[\n"\\]/g;function Kt(e){return e.replace(Gt,function(e){return`\\`+e.charCodeAt(0).toString(16)+` `})}function qt(e,t,n,r,i,a,o,s){e.name=``,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`?e.type=o:e.removeAttribute(`type`),t==null?o!==`submit`&&o!==`reset`||e.removeAttribute(`value`):o===`number`?(t===0&&e.value===``||e.value!=t)&&(e.value=``+zt(t)):e.value!==``+zt(t)&&(e.value=``+zt(t)),t==null?n==null?r!=null&&e.removeAttribute(`value`):Yt(e,o,zt(n)):Yt(e,o,zt(t)),i==null&&a!=null&&(e.defaultChecked=!!a),i!=null&&(e.checked=i&&typeof i!=`function`&&typeof i!=`symbol`),s!=null&&typeof s!=`function`&&typeof s!=`symbol`&&typeof s!=`boolean`?e.name=``+zt(s):e.removeAttribute(`name`)}function Jt(e,t,n,r,i,a,o,s){if(a!=null&&typeof a!=`function`&&typeof a!=`symbol`&&typeof a!=`boolean`&&(e.type=a),t!=null||n!=null){if(!(a!==`submit`&&a!==`reset`||t!=null)){Ht(e);return}n=n==null?``:``+zt(n),t=t==null?n:``+zt(t),s||t===e.value||(e.value=t),e.defaultValue=t}r??=i,r=typeof r!=`function`&&typeof r!=`symbol`&&!!r,e.checked=s?e.checked:!!r,e.defaultChecked=!!r,o!=null&&typeof o!=`function`&&typeof o!=`symbol`&&typeof o!=`boolean`&&(e.name=o),Ht(e)}function Yt(e,t,n){t===`number`&&Wt(e.ownerDocument)===e||e.defaultValue===``+n||(e.defaultValue=``+n)}function Xt(e,t,n,r){if(e=e.options,t){t={};for(var i=0;i<n.length;i++)t[`$`+n[i]]=!0;for(n=0;n<e.length;n++)i=t.hasOwnProperty(`$`+e[n].value),e[n].selected!==i&&(e[n].selected=i),i&&r&&(e[n].defaultSelected=!0)}else{for(n=``+zt(n),t=null,i=0;i<e.length;i++){if(e[i].value===n){e[i].selected=!0,r&&(e[i].defaultSelected=!0);return}t!==null||e[i].disabled||(t=e[i])}t!==null&&(t.selected=!0)}}function Zt(e,t,n){if(t!=null&&(t=``+zt(t),t!==e.value&&(e.value=t),n==null)){e.defaultValue!==t&&(e.defaultValue=t);return}e.defaultValue=n==null?``:``+zt(n)}function Qt(e,t,n,r){if(t==null){if(r!=null){if(n!=null)throw Error(i(92));if(ue(r)){if(1<r.length)throw Error(i(93));r=r[0]}n=r}n??=``,t=n}n=zt(t),e.defaultValue=n,r=e.textContent,r===n&&r!==``&&r!==null&&(e.value=r),Ht(e)}function $t(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var en=new Set(`animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp`.split(` `));function tn(e,t,n){var r=t.indexOf(`--`)===0;n==null||typeof n==`boolean`||n===``?r?e.setProperty(t,``):t===`float`?e.cssFloat=``:e[t]=``:r?e.setProperty(t,n):typeof n!=`number`||n===0||en.has(t)?t===`float`?e.cssFloat=n:e[t]=(``+n).trim():e[t]=n+`px`}function nn(e,t,n){if(t!=null&&typeof t!=`object`)throw Error(i(62));if(e=e.style,n!=null){for(var r in n)!n.hasOwnProperty(r)||t!=null&&t.hasOwnProperty(r)||(r.indexOf(`--`)===0?e.setProperty(r,``):r===`float`?e.cssFloat=``:e[r]=``);for(var a in t)r=t[a],t.hasOwnProperty(a)&&n[a]!==r&&tn(e,a,r)}else for(var o in t)t.hasOwnProperty(o)&&tn(e,o,t[o])}function rn(e){if(e.indexOf(`-`)===-1)return!1;switch(e){case`annotation-xml`:case`color-profile`:case`font-face`:case`font-face-src`:case`font-face-uri`:case`font-face-format`:case`font-face-name`:case`missing-glyph`:return!1;default:return!0}}var an=new Map([[`acceptCharset`,`accept-charset`],[`htmlFor`,`for`],[`httpEquiv`,`http-equiv`],[`crossOrigin`,`crossorigin`],[`accentHeight`,`accent-height`],[`alignmentBaseline`,`alignment-baseline`],[`arabicForm`,`arabic-form`],[`baselineShift`,`baseline-shift`],[`capHeight`,`cap-height`],[`clipPath`,`clip-path`],[`clipRule`,`clip-rule`],[`colorInterpolation`,`color-interpolation`],[`colorInterpolationFilters`,`color-interpolation-filters`],[`colorProfile`,`color-profile`],[`colorRendering`,`color-rendering`],[`dominantBaseline`,`dominant-baseline`],[`enableBackground`,`enable-background`],[`fillOpacity`,`fill-opacity`],[`fillRule`,`fill-rule`],[`floodColor`,`flood-color`],[`floodOpacity`,`flood-opacity`],[`fontFamily`,`font-family`],[`fontSize`,`font-size`],[`fontSizeAdjust`,`font-size-adjust`],[`fontStretch`,`font-stretch`],[`fontStyle`,`font-style`],[`fontVariant`,`font-variant`],[`fontWeight`,`font-weight`],[`glyphName`,`glyph-name`],[`glyphOrientationHorizontal`,`glyph-orientation-horizontal`],[`glyphOrientationVertical`,`glyph-orientation-vertical`],[`horizAdvX`,`horiz-adv-x`],[`horizOriginX`,`horiz-origin-x`],[`imageRendering`,`image-rendering`],[`letterSpacing`,`letter-spacing`],[`lightingColor`,`lighting-color`],[`markerEnd`,`marker-end`],[`markerMid`,`marker-mid`],[`markerStart`,`marker-start`],[`overlinePosition`,`overline-position`],[`overlineThickness`,`overline-thickness`],[`paintOrder`,`paint-order`],[`panose-1`,`panose-1`],[`pointerEvents`,`pointer-events`],[`renderingIntent`,`rendering-intent`],[`shapeRendering`,`shape-rendering`],[`stopColor`,`stop-color`],[`stopOpacity`,`stop-opacity`],[`strikethroughPosition`,`strikethrough-position`],[`strikethroughThickness`,`strikethrough-thickness`],[`strokeDasharray`,`stroke-dasharray`],[`strokeDashoffset`,`stroke-dashoffset`],[`strokeLinecap`,`stroke-linecap`],[`strokeLinejoin`,`stroke-linejoin`],[`strokeMiterlimit`,`stroke-miterlimit`],[`strokeOpacity`,`stroke-opacity`],[`strokeWidth`,`stroke-width`],[`textAnchor`,`text-anchor`],[`textDecoration`,`text-decoration`],[`textRendering`,`text-rendering`],[`transformOrigin`,`transform-origin`],[`underlinePosition`,`underline-position`],[`underlineThickness`,`underline-thickness`],[`unicodeBidi`,`unicode-bidi`],[`unicodeRange`,`unicode-range`],[`unitsPerEm`,`units-per-em`],[`vAlphabetic`,`v-alphabetic`],[`vHanging`,`v-hanging`],[`vIdeographic`,`v-ideographic`],[`vMathematical`,`v-mathematical`],[`vectorEffect`,`vector-effect`],[`vertAdvY`,`vert-adv-y`],[`vertOriginX`,`vert-origin-x`],[`vertOriginY`,`vert-origin-y`],[`wordSpacing`,`word-spacing`],[`writingMode`,`writing-mode`],[`xmlnsXlink`,`xmlns:xlink`],[`xHeight`,`x-height`]]),on=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function sn(e){return on.test(``+e)?`javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`:e}function cn(){}var ln=null;function un(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var dn=null,fn=null;function pn(e){var t=Tt(e);if(t&&(e=t.stateNode)){var n=e[gt]||null;a:switch(e=t.stateNode,t.type){case`input`:if(qt(e,n.value,n.defaultValue,n.defaultValue,n.checked,n.defaultChecked,n.type,n.name),t=n.name,n.type===`radio`&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll(`input[name="`+Kt(``+t)+`"][type="radio"]`),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var a=r[gt]||null;if(!a)throw Error(i(90));qt(r,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name)}}for(t=0;t<n.length;t++)r=n[t],r.form===e.form&&Ut(r)}break a;case`textarea`:Zt(e,n.value,n.defaultValue);break a;case`select`:t=n.value,t!=null&&Xt(e,!!n.multiple,t,!1)}}}var mn=!1;function hn(e,t,n){if(mn)return e(t,n);mn=!0;try{return e(t)}finally{if(mn=!1,(dn!==null||fn!==null)&&(bu(),dn&&(t=dn,e=fn,fn=dn=null,pn(t),e)))for(t=0;t<e.length;t++)pn(e[t])}}function gn(e,t){var n=e.stateNode;if(n===null)return null;var r=n[gt]||null;if(r===null)return null;n=r[t];a:switch(t){case`onClick`:case`onClickCapture`:case`onDoubleClick`:case`onDoubleClickCapture`:case`onMouseDown`:case`onMouseDownCapture`:case`onMouseMove`:case`onMouseMoveCapture`:case`onMouseUp`:case`onMouseUpCapture`:case`onMouseEnter`:(r=!r.disabled)||(e=e.type,r=!(e===`button`||e===`input`||e===`select`||e===`textarea`)),e=!r;break a;default:e=!1}if(e)return null;if(n&&typeof n!=`function`)throw Error(i(231,t,typeof n));return n}var _n=!(typeof window>`u`||window.document===void 0||window.document.createElement===void 0),vn=!1;if(_n)try{var yn={};Object.defineProperty(yn,"passive",{get:function(){vn=!0}}),window.addEventListener(`test`,yn,yn),window.removeEventListener(`test`,yn,yn)}catch{vn=!1}var bn=null,xn=null,Sn=null;function Cn(){if(Sn)return Sn;var e,t=xn,n=t.length,r,i=`value`in bn?bn.value:bn.textContent,a=i.length;for(e=0;e<n&&t[e]===i[e];e++);var o=n-e;for(r=1;r<=o&&t[n-r]===i[a-r];r++);return Sn=i.slice(e,1<r?1-r:void 0)}function wn(e){var t=e.keyCode;return`charCode`in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function Tn(){return!0}function En(){return!1}function Dn(e){function t(t,n,r,i,a){for(var o in this._reactName=t,this._targetInst=r,this.type=n,this.nativeEvent=i,this.target=a,this.currentTarget=null,e)e.hasOwnProperty(o)&&(t=e[o],this[o]=t?t(i):i[o]);return this.isDefaultPrevented=(i.defaultPrevented==null?!1===i.returnValue:i.defaultPrevented)?Tn:En,this.isPropagationStopped=En,this}return h(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():typeof e.returnValue!=`unknown`&&(e.returnValue=!1),this.isDefaultPrevented=Tn)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():typeof e.cancelBubble!=`unknown`&&(e.cancelBubble=!0),this.isPropagationStopped=Tn)},persist:function(){},isPersistent:Tn}),t}var On={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},kn=Dn(On),An=h({},On,{view:0,detail:0}),jn=Dn(An),Mn,Nn,Pn,Fn=h({},An,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Kn,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return`movementX`in e?e.movementX:(e!==Pn&&(Pn&&e.type===`mousemove`?(Mn=e.screenX-Pn.screenX,Nn=e.screenY-Pn.screenY):Nn=Mn=0,Pn=e),Mn)},movementY:function(e){return`movementY`in e?e.movementY:Nn}}),In=Dn(Fn),Ln=Dn(h({},Fn,{dataTransfer:0})),Rn=Dn(h({},An,{relatedTarget:0})),zn=Dn(h({},On,{animationName:0,elapsedTime:0,pseudoElement:0})),Bn=Dn(h({},On,{clipboardData:function(e){return`clipboardData`in e?e.clipboardData:window.clipboardData}})),Vn=Dn(h({},On,{data:0})),Hn={Esc:`Escape`,Spacebar:` `,Left:`ArrowLeft`,Up:`ArrowUp`,Right:`ArrowRight`,Down:`ArrowDown`,Del:`Delete`,Win:`OS`,Menu:`ContextMenu`,Apps:`ContextMenu`,Scroll:`ScrollLock`,MozPrintableKey:`Unidentified`},Un={8:`Backspace`,9:`Tab`,12:`Clear`,13:`Enter`,16:`Shift`,17:`Control`,18:`Alt`,19:`Pause`,20:`CapsLock`,27:`Escape`,32:` `,33:`PageUp`,34:`PageDown`,35:`End`,36:`Home`,37:`ArrowLeft`,38:`ArrowUp`,39:`ArrowRight`,40:`ArrowDown`,45:`Insert`,46:`Delete`,112:`F1`,113:`F2`,114:`F3`,115:`F4`,116:`F5`,117:`F6`,118:`F7`,119:`F8`,120:`F9`,121:`F10`,122:`F11`,123:`F12`,144:`NumLock`,145:`ScrollLock`,224:`Meta`},Wn={Alt:`altKey`,Control:`ctrlKey`,Meta:`metaKey`,Shift:`shiftKey`};function Gn(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=Wn[e])?!!t[e]:!1}function Kn(){return Gn}var qn=Dn(h({},An,{key:function(e){if(e.key){var t=Hn[e.key]||e.key;if(t!==`Unidentified`)return t}return e.type===`keypress`?(e=wn(e),e===13?`Enter`:String.fromCharCode(e)):e.type===`keydown`||e.type===`keyup`?Un[e.keyCode]||`Unidentified`:``},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Kn,charCode:function(e){return e.type===`keypress`?wn(e):0},keyCode:function(e){return e.type===`keydown`||e.type===`keyup`?e.keyCode:0},which:function(e){return e.type===`keypress`?wn(e):e.type===`keydown`||e.type===`keyup`?e.keyCode:0}})),Jn=Dn(h({},Fn,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0})),Yn=Dn(h({},An,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Kn})),Xn=Dn(h({},On,{propertyName:0,elapsedTime:0,pseudoElement:0})),Zn=Dn(h({},Fn,{deltaX:function(e){return`deltaX`in e?e.deltaX:`wheelDeltaX`in e?-e.wheelDeltaX:0},deltaY:function(e){return`deltaY`in e?e.deltaY:`wheelDeltaY`in e?-e.wheelDeltaY:`wheelDelta`in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0})),Qn=Dn(h({},On,{newState:0,oldState:0})),$n=[9,13,27,32],er=_n&&`CompositionEvent`in window,tr=null;_n&&`documentMode`in document&&(tr=document.documentMode);var nr=_n&&`TextEvent`in window&&!tr,rr=_n&&(!er||tr&&8<tr&&11>=tr),ir=` `,ar=!1;function or(e,t){switch(e){case`keyup`:return $n.indexOf(t.keyCode)!==-1;case`keydown`:return t.keyCode!==229;case`keypress`:case`mousedown`:case`focusout`:return!0;default:return!1}}function sr(e){return e=e.detail,typeof e==`object`&&`data`in e?e.data:null}var cr=!1;function lr(e,t){switch(e){case`compositionend`:return sr(t);case`keypress`:return t.which===32?(ar=!0,ir):null;case`textInput`:return e=t.data,e===ir&&ar?null:e;default:return null}}function ur(e,t){if(cr)return e===`compositionend`||!er&&or(e,t)?(e=Cn(),Sn=xn=bn=null,cr=!1,e):null;switch(e){case`paste`:return null;case`keypress`:if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case`compositionend`:return rr&&t.locale!==`ko`?null:t.data;default:return null}}var dr={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function fr(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t===`input`?!!dr[e.type]:t===`textarea`}function pr(e,t,n,r){dn?fn?fn.push(r):fn=[r]:dn=r,t=Ed(t,`onChange`),0<t.length&&(n=new kn(`onChange`,`change`,null,n,r),e.push({event:n,listeners:t}))}var mr=null,hr=null;function gr(e){yd(e,0)}function _r(e){if(Ut(Et(e)))return e}function vr(e,t){if(e===`change`)return t}var yr=!1;if(_n){var br;if(_n){var xr=`oninput`in document;if(!xr){var Sr=document.createElement(`div`);Sr.setAttribute(`oninput`,`return;`),xr=typeof Sr.oninput==`function`}br=xr}else br=!1;yr=br&&(!document.documentMode||9<document.documentMode)}function Cr(){mr&&(mr.detachEvent(`onpropertychange`,wr),hr=mr=null)}function wr(e){if(e.propertyName===`value`&&_r(hr)){var t=[];pr(t,hr,e,un(e)),hn(gr,t)}}function Tr(e,t,n){e===`focusin`?(Cr(),mr=t,hr=n,mr.attachEvent(`onpropertychange`,wr)):e===`focusout`&&Cr()}function Er(e){if(e===`selectionchange`||e===`keyup`||e===`keydown`)return _r(hr)}function Dr(e,t){if(e===`click`)return _r(t)}function Or(e,t){if(e===`input`||e===`change`)return _r(t)}function kr(e,t){return e===t&&(e!==0||1/e==1/t)||e!==e&&t!==t}var Ar=typeof Object.is==`function`?Object.is:kr;function jr(e,t){if(Ar(e,t))return!0;if(typeof e!=`object`||!e||typeof t!=`object`||!t)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var i=n[r];if(!ke.call(t,i)||!Ar(e[i],t[i]))return!1}return!0}function Mr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Nr(e,t){var n=Mr(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}a:{for(;n;){if(n.nextSibling){n=n.nextSibling;break a}n=n.parentNode}n=void 0}n=Mr(n)}}function Pr(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?Pr(e,t.parentNode):`contains`in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Fr(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var t=Wt(e.document);t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href==`string`}catch{n=!1}if(n)e=t.contentWindow;else break;t=Wt(e.document)}return t}function Ir(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t===`input`&&(e.type===`text`||e.type===`search`||e.type===`tel`||e.type===`url`||e.type===`password`)||t===`textarea`||e.contentEditable===`true`)}var Lr=_n&&`documentMode`in document&&11>=document.documentMode,Rr=null,zr=null,Br=null,Vr=!1;function Hr(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;Vr||Rr==null||Rr!==Wt(r)||(r=Rr,`selectionStart`in r&&Ir(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Br&&jr(Br,r)||(Br=r,r=Ed(zr,`onSelect`),0<r.length&&(t=new kn(`onSelect`,`select`,null,t,n),e.push({event:t,listeners:r}),t.target=Rr)))}function Ur(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n[`Webkit`+e]=`webkit`+t,n[`Moz`+e]=`moz`+t,n}var Wr={animationend:Ur(`Animation`,`AnimationEnd`),animationiteration:Ur(`Animation`,`AnimationIteration`),animationstart:Ur(`Animation`,`AnimationStart`),transitionrun:Ur(`Transition`,`TransitionRun`),transitionstart:Ur(`Transition`,`TransitionStart`),transitioncancel:Ur(`Transition`,`TransitionCancel`),transitionend:Ur(`Transition`,`TransitionEnd`)},Gr={},Kr={};_n&&(Kr=document.createElement(`div`).style,`AnimationEvent`in window||(delete Wr.animationend.animation,delete Wr.animationiteration.animation,delete Wr.animationstart.animation),`TransitionEvent`in window||delete Wr.transitionend.transition);function qr(e){if(Gr[e])return Gr[e];if(!Wr[e])return e;var t=Wr[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in Kr)return Gr[e]=t[n];return e}var Jr=qr(`animationend`),Yr=qr(`animationiteration`),Xr=qr(`animationstart`),Zr=qr(`transitionrun`),Qr=qr(`transitionstart`),$r=qr(`transitioncancel`),ei=qr(`transitionend`),ti=new Map,ni=`abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel`.split(` `);ni.push(`scrollEnd`);function ri(e,t){ti.set(e,t),At(t,[e])}var ii=typeof reportError==`function`?reportError:function(e){if(typeof window==`object`&&typeof window.ErrorEvent==`function`){var t=new window.ErrorEvent(`error`,{bubbles:!0,cancelable:!0,message:typeof e==`object`&&e&&typeof e.message==`string`?String(e.message):String(e),error:e});if(!window.dispatchEvent(t))return}else if(typeof process==`object`&&typeof process.emit==`function`){process.emit(`uncaughtException`,e);return}console.error(e)},ai=[],oi=0,si=0;function ci(){for(var e=oi,t=si=oi=0;t<e;){var n=ai[t];ai[t++]=null;var r=ai[t];ai[t++]=null;var i=ai[t];ai[t++]=null;var a=ai[t];if(ai[t++]=null,r!==null&&i!==null){var o=r.pending;o===null?i.next=i:(i.next=o.next,o.next=i),r.pending=i}a!==0&&fi(n,i,a)}}function li(e,t,n,r){ai[oi++]=e,ai[oi++]=t,ai[oi++]=n,ai[oi++]=r,si|=r,e.lanes|=r,e=e.alternate,e!==null&&(e.lanes|=r)}function ui(e,t,n,r){return li(e,t,n,r),pi(e)}function di(e,t){return li(e,null,null,t),pi(e)}function fi(e,t,n){e.lanes|=n;var r=e.alternate;r!==null&&(r.lanes|=n);for(var i=!1,a=e.return;a!==null;)a.childLanes|=n,r=a.alternate,r!==null&&(r.childLanes|=n),a.tag===22&&(e=a.stateNode,e===null||e._visibility&1||(i=!0)),e=a,a=a.return;return e.tag===3?(a=e.stateNode,i&&t!==null&&(i=31-Ke(n),e=a.hiddenUpdates,r=e[i],r===null?e[i]=[t]:r.push(t),t.lane=n|536870912),a):null}function pi(e){if(50<du)throw du=0,fu=null,Error(i(185));for(var t=e.return;t!==null;)e=t,t=e.return;return e.tag===3?e.stateNode:null}var mi={};function hi(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function gi(e,t,n,r){return new hi(e,t,n,r)}function _i(e){return e=e.prototype,!(!e||!e.isReactComponent)}function vi(e,t){var n=e.alternate;return n===null?(n=gi(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&65011712,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n.refCleanup=e.refCleanup,n}function yi(e,t){e.flags&=65011714;var n=e.alternate;return n===null?(e.childLanes=0,e.lanes=t,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=n.childLanes,e.lanes=n.lanes,e.child=n.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=n.memoizedProps,e.memoizedState=n.memoizedState,e.updateQueue=n.updateQueue,e.type=n.type,t=n.dependencies,e.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext}),e}function bi(e,t,n,r,a,o){var s=0;if(r=e,typeof e==`function`)_i(e)&&(s=1);else if(typeof e==`string`)s=Uf(e,n,me.current)?26:e===`html`||e===`head`||e===`body`?27:5;else a:switch(e){case ie:return e=gi(31,n,t,a),e.elementType=ie,e.lanes=o,e;case y:return xi(n.children,a,o,t);case b:s=8,a|=24;break;case x:return e=gi(12,n,t,a|2),e.elementType=x,e.lanes=o,e;case te:return e=gi(13,n,t,a),e.elementType=te,e.lanes=o,e;case ne:return e=gi(19,n,t,a),e.elementType=ne,e.lanes=o,e;default:if(typeof e==`object`&&e)switch(e.$$typeof){case S:s=10;break a;case ee:s=9;break a;case C:s=11;break a;case re:s=14;break a;case w:s=16,r=null;break a}s=29,n=Error(i(130,e===null?`null`:typeof e,``)),r=null}return t=gi(s,n,t,a),t.elementType=e,t.type=r,t.lanes=o,t}function xi(e,t,n,r){return e=gi(7,e,r,t),e.lanes=n,e}function Si(e,t,n){return e=gi(6,e,null,t),e.lanes=n,e}function Ci(e){var t=gi(18,null,null,0);return t.stateNode=e,t}function wi(e,t,n){return t=gi(4,e.children===null?[]:e.children,e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}var Ti=new WeakMap;function Ei(e,t){if(typeof e==`object`&&e){var n=Ti.get(e);return n===void 0?(t={value:e,source:t,stack:Oe(t)},Ti.set(e,t),t):n}return{value:e,source:t,stack:Oe(t)}}var Di=[],Oi=0,ki=null,Ai=0,ji=[],Mi=0,Ni=null,Pi=1,Fi=``;function Ii(e,t){Di[Oi++]=Ai,Di[Oi++]=ki,ki=e,Ai=t}function Li(e,t,n){ji[Mi++]=Pi,ji[Mi++]=Fi,ji[Mi++]=Ni,Ni=e;var r=Pi;e=Fi;var i=32-Ke(r)-1;r&=~(1<<i),n+=1;var a=32-Ke(t)+i;if(30<a){var o=i-i%5;a=(r&(1<<o)-1).toString(32),r>>=o,i-=o,Pi=1<<32-Ke(t)+i|n<<i|r,Fi=a+e}else Pi=1<<a|n<<i|r,Fi=e}function Ri(e){e.return!==null&&(Ii(e,1),Li(e,1,0))}function zi(e){for(;e===ki;)ki=Di[--Oi],Di[Oi]=null,Ai=Di[--Oi],Di[Oi]=null;for(;e===Ni;)Ni=ji[--Mi],ji[Mi]=null,Fi=ji[--Mi],ji[Mi]=null,Pi=ji[--Mi],ji[Mi]=null}function Bi(e,t){ji[Mi++]=Pi,ji[Mi++]=Fi,ji[Mi++]=Ni,Pi=t.id,Fi=t.overflow,Ni=e}var Vi=null,j=null,M=!1,Hi=null,Ui=!1,Wi=Error(i(519));function Gi(e){throw Zi(Ei(Error(i(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?`text`:`HTML`,``)),e)),Wi}function Ki(e){var t=e.stateNode,n=e.type,r=e.memoizedProps;switch(t[ht]=e,t[gt]=r,n){case`dialog`:Q(`cancel`,t),Q(`close`,t);break;case`iframe`:case`object`:case`embed`:Q(`load`,t);break;case`video`:case`audio`:for(n=0;n<_d.length;n++)Q(_d[n],t);break;case`source`:Q(`error`,t);break;case`img`:case`image`:case`link`:Q(`error`,t),Q(`load`,t);break;case`details`:Q(`toggle`,t);break;case`input`:Q(`invalid`,t),Jt(t,r.value,r.defaultValue,r.checked,r.defaultChecked,r.type,r.name,!0);break;case`select`:Q(`invalid`,t);break;case`textarea`:Q(`invalid`,t),Qt(t,r.value,r.defaultValue,r.children)}n=r.children,typeof n!=`string`&&typeof n!=`number`&&typeof n!=`bigint`||t.textContent===``+n||!0===r.suppressHydrationWarning||Md(t.textContent,n)?(r.popover!=null&&(Q(`beforetoggle`,t),Q(`toggle`,t)),r.onScroll!=null&&Q(`scroll`,t),r.onScrollEnd!=null&&Q(`scrollend`,t),r.onClick!=null&&(t.onclick=cn),t=!0):t=!1,t||Gi(e,!0)}function qi(e){for(Vi=e.return;Vi;)switch(Vi.tag){case 5:case 31:case 13:Ui=!1;return;case 27:case 3:Ui=!0;return;default:Vi=Vi.return}}function Ji(e){if(e!==Vi)return!1;if(!M)return qi(e),M=!0,!1;var t=e.tag,n;if((n=t!==3&&t!==27)&&((n=t===5)&&(n=e.type,n=!(n!==`form`&&n!==`button`)||Ud(e.type,e.memoizedProps)),n=!n),n&&j&&Gi(e),qi(e),t===13){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));j=uf(e)}else if(t===31){if(e=e.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(317));j=uf(e)}else t===27?(t=j,Zd(e.type)?(e=lf,lf=null,j=e):j=t):j=Vi?cf(e.stateNode.nextSibling):null;return!0}function Yi(){j=Vi=null,M=!1}function Xi(){var e=Hi;return e!==null&&(Ql===null?Ql=e:Ql.push.apply(Ql,e),Hi=null),e}function Zi(e){Hi===null?Hi=[e]:Hi.push(e)}var Qi=pe(null),$i=null,ea=null;function ta(e,t,n){k(Qi,t._currentValue),t._currentValue=n}function na(e){e._currentValue=Qi.current,O(Qi)}function ra(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)===t?r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t):(e.childLanes|=t,r!==null&&(r.childLanes|=t)),e===n)break;e=e.return}}function ia(e,t,n,r){var a=e.child;for(a!==null&&(a.return=e);a!==null;){var o=a.dependencies;if(o!==null){var s=a.child;o=o.firstContext;a:for(;o!==null;){var c=o;o=a;for(var l=0;l<t.length;l++)if(c.context===t[l]){o.lanes|=n,c=o.alternate,c!==null&&(c.lanes|=n),ra(o.return,n,e),r||(s=null);break a}o=c.next}}else if(a.tag===18){if(s=a.return,s===null)throw Error(i(341));s.lanes|=n,o=s.alternate,o!==null&&(o.lanes|=n),ra(s,n,e),s=null}else s=a.child;if(s!==null)s.return=a;else for(s=a;s!==null;){if(s===e){s=null;break}if(a=s.sibling,a!==null){a.return=s.return,s=a;break}s=s.return}a=s}}function aa(e,t,n,r){e=null;for(var a=t,o=!1;a!==null;){if(!o){if(a.flags&524288)o=!0;else if(a.flags&262144)break}if(a.tag===10){var s=a.alternate;if(s===null)throw Error(i(387));if(s=s.memoizedProps,s!==null){var c=a.type;Ar(a.pendingProps.value,s.value)||(e===null?e=[c]:e.push(c))}}else if(a===_e.current){if(s=a.alternate,s===null)throw Error(i(387));s.memoizedState.memoizedState!==a.memoizedState.memoizedState&&(e===null?e=[Qf]:e.push(Qf))}a=a.return}e!==null&&ia(t,e,n,r),t.flags|=262144}function oa(e){for(e=e.firstContext;e!==null;){if(!Ar(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function sa(e){$i=e,ea=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function ca(e){return ua($i,e)}function la(e,t){return $i===null&&sa(e),ua(e,t)}function ua(e,t){var n=t._currentValue;if(t={context:t,memoizedValue:n,next:null},ea===null){if(e===null)throw Error(i(308));ea=t,e.dependencies={lanes:0,firstContext:t},e.flags|=524288}else ea=ea.next=t;return n}var da=typeof AbortController<`u`?AbortController:function(){var e=[],t=this.signal={aborted:!1,addEventListener:function(t,n){e.push(n)}};this.abort=function(){t.aborted=!0,e.forEach(function(e){return e()})}},fa=t.unstable_scheduleCallback,pa=t.unstable_NormalPriority,N={$$typeof:S,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function ma(){return{controller:new da,data:new Map,refCount:0}}function ha(e){e.refCount--,e.refCount===0&&fa(pa,function(){e.controller.abort()})}var ga=null,_a=0,va=0,ya=null;function ba(e,t){if(ga===null){var n=ga=[];_a=0,va=dd(),ya={status:`pending`,value:void 0,then:function(e){n.push(e)}}}return _a++,t.then(xa,xa),t}function xa(){if(--_a===0&&ga!==null){ya!==null&&(ya.status=`fulfilled`);var e=ga;ga=null,va=0,ya=null;for(var t=0;t<e.length;t++)(0,e[t])()}}function Sa(e,t){var n=[],r={status:`pending`,value:null,reason:null,then:function(e){n.push(e)}};return e.then(function(){r.status=`fulfilled`,r.value=t;for(var e=0;e<n.length;e++)(0,n[e])(t)},function(e){for(r.status=`rejected`,r.reason=e,e=0;e<n.length;e++)(0,n[e])(void 0)}),r}var Ca=T.S;T.S=function(e,t){tu=Pe(),typeof t==`object`&&t&&typeof t.then==`function`&&ba(e,t),Ca!==null&&Ca(e,t)};var wa=pe(null);function Ta(){var e=wa.current;return e===null?G.pooledCache:e}function Ea(e,t){t===null?k(wa,wa.current):k(wa,t.pool)}function Da(){var e=Ta();return e===null?null:{parent:N._currentValue,pool:e}}var Oa=Error(i(460)),ka=Error(i(474)),Aa=Error(i(542)),ja={then:function(){}};function Ma(e){return e=e.status,e===`fulfilled`||e===`rejected`}function Na(e,t,n){switch(n=e[n],n===void 0?e.push(t):n!==t&&(t.then(cn,cn),t=n),t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,La(e),e;default:if(typeof t.status==`string`)t.then(cn,cn);else{if(e=G,e!==null&&100<e.shellSuspendCounter)throw Error(i(482));e=t,e.status=`pending`,e.then(function(e){if(t.status===`pending`){var n=t;n.status=`fulfilled`,n.value=e}},function(e){if(t.status===`pending`){var n=t;n.status=`rejected`,n.reason=e}})}switch(t.status){case`fulfilled`:return t.value;case`rejected`:throw e=t.reason,La(e),e}throw Fa=t,Oa}}function Pa(e){try{var t=e._init;return t(e._payload)}catch(e){throw typeof e==`object`&&e&&typeof e.then==`function`?(Fa=e,Oa):e}}var Fa=null;function Ia(){if(Fa===null)throw Error(i(459));var e=Fa;return Fa=null,e}function La(e){if(e===Oa||e===Aa)throw Error(i(483))}var Ra=null,za=0;function Ba(e){var t=za;return za+=1,Ra===null&&(Ra=[]),Na(Ra,e,t)}function Va(e,t){t=t.props.ref,e.ref=t===void 0?null:t}function Ha(e,t){throw t.$$typeof===g?Error(i(525)):(e=Object.prototype.toString.call(t),Error(i(31,e===`[object Object]`?`object with keys {`+Object.keys(t).join(`, `)+`}`:e)))}function Ua(e){function t(t,n){if(e){var r=t.deletions;r===null?(t.deletions=[n],t.flags|=16):r.push(n)}}function n(n,r){if(!e)return null;for(;r!==null;)t(n,r),r=r.sibling;return null}function r(e){for(var t=new Map;e!==null;)e.key===null?t.set(e.index,e):t.set(e.key,e),e=e.sibling;return t}function a(e,t){return e=vi(e,t),e.index=0,e.sibling=null,e}function o(t,n,r){return t.index=r,e?(r=t.alternate,r===null?(t.flags|=67108866,n):(r=r.index,r<n?(t.flags|=67108866,n):r)):(t.flags|=1048576,n)}function s(t){return e&&t.alternate===null&&(t.flags|=67108866),t}function c(e,t,n,r){return t===null||t.tag!==6?(t=Si(n,e.mode,r),t.return=e,t):(t=a(t,n),t.return=e,t)}function l(e,t,n,r){var i=n.type;return i===y?d(e,t,n.props.children,r,n.key):t!==null&&(t.elementType===i||typeof i==`object`&&i&&i.$$typeof===w&&Pa(i)===t.type)?(t=a(t,n.props),Va(t,n),t.return=e,t):(t=bi(n.type,n.key,n.props,null,e.mode,r),Va(t,n),t.return=e,t)}function u(e,t,n,r){return t===null||t.tag!==4||t.stateNode.containerInfo!==n.containerInfo||t.stateNode.implementation!==n.implementation?(t=wi(n,e.mode,r),t.return=e,t):(t=a(t,n.children||[]),t.return=e,t)}function d(e,t,n,r,i){return t===null||t.tag!==7?(t=xi(n,e.mode,r,i),t.return=e,t):(t=a(t,n),t.return=e,t)}function f(e,t,n){if(typeof t==`string`&&t!==``||typeof t==`number`||typeof t==`bigint`)return t=Si(``+t,e.mode,n),t.return=e,t;if(typeof t==`object`&&t){switch(t.$$typeof){case _:return n=bi(t.type,t.key,t.props,null,e.mode,n),Va(n,t),n.return=e,n;case v:return t=wi(t,e.mode,n),t.return=e,t;case w:return t=Pa(t),f(e,t,n)}if(ue(t)||se(t))return t=xi(t,e.mode,n,null),t.return=e,t;if(typeof t.then==`function`)return f(e,Ba(t),n);if(t.$$typeof===S)return f(e,la(e,t),n);Ha(e,t)}return null}function p(e,t,n,r){var i=t===null?null:t.key;if(typeof n==`string`&&n!==``||typeof n==`number`||typeof n==`bigint`)return i===null?c(e,t,``+n,r):null;if(typeof n==`object`&&n){switch(n.$$typeof){case _:return n.key===i?l(e,t,n,r):null;case v:return n.key===i?u(e,t,n,r):null;case w:return n=Pa(n),p(e,t,n,r)}if(ue(n)||se(n))return i===null?d(e,t,n,r,null):null;if(typeof n.then==`function`)return p(e,t,Ba(n),r);if(n.$$typeof===S)return p(e,t,la(e,n),r);Ha(e,n)}return null}function m(e,t,n,r,i){if(typeof r==`string`&&r!==``||typeof r==`number`||typeof r==`bigint`)return e=e.get(n)||null,c(t,e,``+r,i);if(typeof r==`object`&&r){switch(r.$$typeof){case _:return e=e.get(r.key===null?n:r.key)||null,l(t,e,r,i);case v:return e=e.get(r.key===null?n:r.key)||null,u(t,e,r,i);case w:return r=Pa(r),m(e,t,n,r,i)}if(ue(r)||se(r))return e=e.get(n)||null,d(t,e,r,i,null);if(typeof r.then==`function`)return m(e,t,n,Ba(r),i);if(r.$$typeof===S)return m(e,t,n,la(t,r),i);Ha(t,r)}return null}function h(i,a,s,c){for(var l=null,u=null,d=a,h=a=0,g=null;d!==null&&h<s.length;h++){d.index>h?(g=d,d=null):g=d.sibling;var _=p(i,d,s[h],c);if(_===null){d===null&&(d=g);break}e&&d&&_.alternate===null&&t(i,d),a=o(_,a,h),u===null?l=_:u.sibling=_,u=_,d=g}if(h===s.length)return n(i,d),M&&Ii(i,h),l;if(d===null){for(;h<s.length;h++)d=f(i,s[h],c),d!==null&&(a=o(d,a,h),u===null?l=d:u.sibling=d,u=d);return M&&Ii(i,h),l}for(d=r(d);h<s.length;h++)g=m(d,i,h,s[h],c),g!==null&&(e&&g.alternate!==null&&d.delete(g.key===null?h:g.key),a=o(g,a,h),u===null?l=g:u.sibling=g,u=g);return e&&d.forEach(function(e){return t(i,e)}),M&&Ii(i,h),l}function g(a,s,c,l){if(c==null)throw Error(i(151));for(var u=null,d=null,h=s,g=s=0,_=null,v=c.next();h!==null&&!v.done;g++,v=c.next()){h.index>g?(_=h,h=null):_=h.sibling;var y=p(a,h,v.value,l);if(y===null){h===null&&(h=_);break}e&&h&&y.alternate===null&&t(a,h),s=o(y,s,g),d===null?u=y:d.sibling=y,d=y,h=_}if(v.done)return n(a,h),M&&Ii(a,g),u;if(h===null){for(;!v.done;g++,v=c.next())v=f(a,v.value,l),v!==null&&(s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return M&&Ii(a,g),u}for(h=r(h);!v.done;g++,v=c.next())v=m(h,a,g,v.value,l),v!==null&&(e&&v.alternate!==null&&h.delete(v.key===null?g:v.key),s=o(v,s,g),d===null?u=v:d.sibling=v,d=v);return e&&h.forEach(function(e){return t(a,e)}),M&&Ii(a,g),u}function b(e,r,o,c){if(typeof o==`object`&&o&&o.type===y&&o.key===null&&(o=o.props.children),typeof o==`object`&&o){switch(o.$$typeof){case _:a:{for(var l=o.key;r!==null;){if(r.key===l){if(l=o.type,l===y){if(r.tag===7){n(e,r.sibling),c=a(r,o.props.children),c.return=e,e=c;break a}}else if(r.elementType===l||typeof l==`object`&&l&&l.$$typeof===w&&Pa(l)===r.type){n(e,r.sibling),c=a(r,o.props),Va(c,o),c.return=e,e=c;break a}n(e,r);break}else t(e,r);r=r.sibling}o.type===y?(c=xi(o.props.children,e.mode,c,o.key),c.return=e,e=c):(c=bi(o.type,o.key,o.props,null,e.mode,c),Va(c,o),c.return=e,e=c)}return s(e);case v:a:{for(l=o.key;r!==null;){if(r.key===l)if(r.tag===4&&r.stateNode.containerInfo===o.containerInfo&&r.stateNode.implementation===o.implementation){n(e,r.sibling),c=a(r,o.children||[]),c.return=e,e=c;break a}else{n(e,r);break}else t(e,r);r=r.sibling}c=wi(o,e.mode,c),c.return=e,e=c}return s(e);case w:return o=Pa(o),b(e,r,o,c)}if(ue(o))return h(e,r,o,c);if(se(o)){if(l=se(o),typeof l!=`function`)throw Error(i(150));return o=l.call(o),g(e,r,o,c)}if(typeof o.then==`function`)return b(e,r,Ba(o),c);if(o.$$typeof===S)return b(e,r,la(e,o),c);Ha(e,o)}return typeof o==`string`&&o!==``||typeof o==`number`||typeof o==`bigint`?(o=``+o,r!==null&&r.tag===6?(n(e,r.sibling),c=a(r,o),c.return=e,e=c):(n(e,r),c=Si(o,e.mode,c),c.return=e,e=c),s(e)):n(e,r)}return function(e,t,n,r){try{za=0;var i=b(e,t,n,r);return Ra=null,i}catch(t){if(t===Oa||t===Aa)throw t;var a=gi(29,t,null,e.mode);return a.lanes=r,a.return=e,a}}}var Wa=Ua(!0),Ga=Ua(!1),Ka=!1;function qa(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function Ja(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Ya(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Xa(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,W&2){var i=r.pending;return i===null?t.next=t:(t.next=i.next,i.next=t),r.pending=t,t=pi(e),fi(e,null,n),t}return li(e,r,t,n),pi(e)}function Za(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,n&4194048)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,ct(e,n)}}function Qa(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var i=null,a=null;if(n=n.firstBaseUpdate,n!==null){do{var o={lane:n.lane,tag:n.tag,payload:n.payload,callback:null,next:null};a===null?i=a=o:a=a.next=o,n=n.next}while(n!==null);a===null?i=a=t:a=a.next=t}else i=a=t;n={baseState:r.baseState,firstBaseUpdate:i,lastBaseUpdate:a,shared:r.shared,callbacks:r.callbacks},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}var $a=!1;function eo(){if($a){var e=ya;if(e!==null)throw e}}function to(e,t,n,r){$a=!1;var i=e.updateQueue;Ka=!1;var a=i.firstBaseUpdate,o=i.lastBaseUpdate,s=i.shared.pending;if(s!==null){i.shared.pending=null;var c=s,l=c.next;c.next=null,o===null?a=l:o.next=l,o=c;var u=e.alternate;u!==null&&(u=u.updateQueue,s=u.lastBaseUpdate,s!==o&&(s===null?u.firstBaseUpdate=l:s.next=l,u.lastBaseUpdate=c))}if(a!==null){var d=i.baseState;o=0,u=l=c=null,s=a;do{var f=s.lane&-536870913,p=f!==s.lane;if(p?(q&f)===f:(r&f)===f){f!==0&&f===va&&($a=!0),u!==null&&(u=u.next={lane:0,tag:s.tag,payload:s.payload,callback:null,next:null});a:{var m=e,g=s;f=t;var _=n;switch(g.tag){case 1:if(m=g.payload,typeof m==`function`){d=m.call(_,d,f);break a}d=m;break a;case 3:m.flags=m.flags&-65537|128;case 0:if(m=g.payload,f=typeof m==`function`?m.call(_,d,f):m,f==null)break a;d=h({},d,f);break a;case 2:Ka=!0}}f=s.callback,f!==null&&(e.flags|=64,p&&(e.flags|=8192),p=i.callbacks,p===null?i.callbacks=[f]:p.push(f))}else p={lane:f,tag:s.tag,payload:s.payload,callback:s.callback,next:null},u===null?(l=u=p,c=d):u=u.next=p,o|=f;if(s=s.next,s===null){if(s=i.shared.pending,s===null)break;p=s,s=p.next,p.next=null,i.lastBaseUpdate=p,i.shared.pending=null}}while(1);u===null&&(c=d),i.baseState=c,i.firstBaseUpdate=l,i.lastBaseUpdate=u,a===null&&(i.shared.lanes=0),Kl|=o,e.lanes=o,e.memoizedState=d}}function no(e,t){if(typeof e!=`function`)throw Error(i(191,e));e.call(t)}function ro(e,t){var n=e.callbacks;if(n!==null)for(e.callbacks=null,e=0;e<n.length;e++)no(n[e],t)}var io=pe(null),ao=pe(0);function oo(e,t){e=Gl,k(ao,e),k(io,t),Gl=e|t.baseLanes}function so(){k(ao,Gl),k(io,io.current)}function co(){Gl=ao.current,O(io),O(ao)}var lo=pe(null),uo=null;function fo(e){var t=e.alternate;k(P,P.current&1),k(lo,e),uo===null&&(t===null||io.current!==null||t.memoizedState!==null)&&(uo=e)}function po(e){k(P,P.current),k(lo,e),uo===null&&(uo=e)}function mo(e){e.tag===22?(k(P,P.current),k(lo,e),uo===null&&(uo=e)):ho(e)}function ho(){k(P,P.current),k(lo,lo.current)}function go(e){O(lo),uo===e&&(uo=null),O(P)}var P=pe(0);function _o(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||af(n)||of(n)))return t}else if(t.tag===19&&(t.memoizedProps.revealOrder===`forwards`||t.memoizedProps.revealOrder===`backwards`||t.memoizedProps.revealOrder===`unstable_legacy-backwards`||t.memoizedProps.revealOrder===`together`)){if(t.flags&128)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var vo=0,F=null,I=null,L=null,yo=!1,bo=!1,xo=!1,So=0,Co=0,wo=null,To=0;function R(){throw Error(i(321))}function Eo(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!Ar(e[n],t[n]))return!1;return!0}function Do(e,t,n,r,i,a){return vo=a,F=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,T.H=e===null||e.memoizedState===null?Us:Ws,xo=!1,a=n(r,i),xo=!1,bo&&(a=ko(t,n,r,i)),Oo(e),a}function Oo(e){T.H=Hs;var t=I!==null&&I.next!==null;if(vo=0,L=I=F=null,yo=!1,Co=0,wo=null,t)throw Error(i(300));e===null||B||(e=e.dependencies,e!==null&&oa(e)&&(B=!0))}function ko(e,t,n,r){F=e;var a=0;do{if(bo&&(wo=null),Co=0,bo=!1,25<=a)throw Error(i(301));if(a+=1,L=I=null,e.updateQueue!=null){var o=e.updateQueue;o.lastEffect=null,o.events=null,o.stores=null,o.memoCache!=null&&(o.memoCache.index=0)}T.H=Gs,o=t(n,r)}while(bo);return o}function Ao(){var e=T.H,t=e.useState()[0];return t=typeof t.then==`function`?Io(t):t,e=e.useState()[0],(I===null?null:I.memoizedState)!==e&&(F.flags|=1024),t}function jo(){var e=So!==0;return So=0,e}function Mo(e,t,n){t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~n}function No(e){if(yo){for(e=e.memoizedState;e!==null;){var t=e.queue;t!==null&&(t.pending=null),e=e.next}yo=!1}vo=0,L=I=F=null,bo=!1,Co=So=0,wo=null}function Po(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return L===null?F.memoizedState=L=e:L=L.next=e,L}function z(){if(I===null){var e=F.alternate;e=e===null?null:e.memoizedState}else e=I.next;var t=L===null?F.memoizedState:L.next;if(t!==null)L=t,I=e;else{if(e===null)throw F.alternate===null?Error(i(467)):Error(i(310));I=e,e={memoizedState:I.memoizedState,baseState:I.baseState,baseQueue:I.baseQueue,queue:I.queue,next:null},L===null?F.memoizedState=L=e:L=L.next=e}return L}function Fo(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function Io(e){var t=Co;return Co+=1,wo===null&&(wo=[]),e=Na(wo,e,t),t=F,(L===null?t.memoizedState:L.next)===null&&(t=t.alternate,T.H=t===null||t.memoizedState===null?Us:Ws),e}function Lo(e){if(typeof e==`object`&&e){if(typeof e.then==`function`)return Io(e);if(e.$$typeof===S)return ca(e)}throw Error(i(438,String(e)))}function Ro(e){var t=null,n=F.updateQueue;if(n!==null&&(t=n.memoCache),t==null){var r=F.alternate;r!==null&&(r=r.updateQueue,r!==null&&(r=r.memoCache,r!=null&&(t={data:r.data.map(function(e){return e.slice()}),index:0})))}if(t??={data:[],index:0},n===null&&(n=Fo(),F.updateQueue=n),n.memoCache=t,n=t.data[t.index],n===void 0)for(n=t.data[t.index]=Array(e),r=0;r<e;r++)n[r]=ae;return t.index++,n}function zo(e,t){return typeof t==`function`?t(e):t}function Bo(e){return Vo(z(),I,e)}function Vo(e,t,n){var r=e.queue;if(r===null)throw Error(i(311));r.lastRenderedReducer=n;var a=e.baseQueue,o=r.pending;if(o!==null){if(a!==null){var s=a.next;a.next=o.next,o.next=s}t.baseQueue=a=o,r.pending=null}if(o=e.baseState,a===null)e.memoizedState=o;else{t=a.next;var c=s=null,l=null,u=t,d=!1;do{var f=u.lane&-536870913;if(f===u.lane?(vo&f)===f:(q&f)===f){var p=u.revertLane;if(p===0)l!==null&&(l=l.next={lane:0,revertLane:0,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null}),f===va&&(d=!0);else if((vo&p)===p){u=u.next,p===va&&(d=!0);continue}else f={lane:0,revertLane:u.revertLane,gesture:null,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=f,s=o):l=l.next=f,F.lanes|=p,Kl|=p;f=u.action,xo&&n(o,f),o=u.hasEagerState?u.eagerState:n(o,f)}else p={lane:f,revertLane:u.revertLane,gesture:u.gesture,action:u.action,hasEagerState:u.hasEagerState,eagerState:u.eagerState,next:null},l===null?(c=l=p,s=o):l=l.next=p,F.lanes|=f,Kl|=f;u=u.next}while(u!==null&&u!==t);if(l===null?s=o:l.next=c,!Ar(o,e.memoizedState)&&(B=!0,d&&(n=ya,n!==null)))throw n;e.memoizedState=o,e.baseState=s,e.baseQueue=l,r.lastRenderedState=o}return a===null&&(r.lanes=0),[e.memoizedState,r.dispatch]}function Ho(e){var t=z(),n=t.queue;if(n===null)throw Error(i(311));n.lastRenderedReducer=e;var r=n.dispatch,a=n.pending,o=t.memoizedState;if(a!==null){n.pending=null;var s=a=a.next;do o=e(o,s.action),s=s.next;while(s!==a);Ar(o,t.memoizedState)||(B=!0),t.memoizedState=o,t.baseQueue===null&&(t.baseState=o),n.lastRenderedState=o}return[o,r]}function Uo(e,t,n){var r=F,a=z(),o=M;if(o){if(n===void 0)throw Error(i(407));n=n()}else n=t();var s=!Ar((I||a).memoizedState,n);if(s&&(a.memoizedState=n,B=!0),a=a.queue,ms(Ko.bind(null,r,a,e),[e]),a.getSnapshot!==t||s||L!==null&&L.memoizedState.tag&1){if(r.flags|=2048,ls(9,{destroy:void 0},Go.bind(null,r,a,n,t),null),G===null)throw Error(i(349));o||vo&127||Wo(r,t,n)}return n}function Wo(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=F.updateQueue,t===null?(t=Fo(),F.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Go(e,t,n,r){t.value=n,t.getSnapshot=r,qo(t)&&Jo(e)}function Ko(e,t,n){return n(function(){qo(t)&&Jo(e)})}function qo(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Ar(e,n)}catch{return!0}}function Jo(e){var t=di(e,2);t!==null&&hu(t,e,2)}function Yo(e){var t=Po();if(typeof e==`function`){var n=e;if(e=n(),xo){Ge(!0);try{n()}finally{Ge(!1)}}}return t.memoizedState=t.baseState=e,t.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:zo,lastRenderedState:e},t}function Xo(e,t,n,r){return e.baseState=n,Vo(e,I,typeof r==`function`?r:zo)}function Zo(e,t,n,r,a){if(zs(e))throw Error(i(485));if(e=t.action,e!==null){var o={payload:a,action:e,next:null,isTransition:!0,status:`pending`,value:null,reason:null,listeners:[],then:function(e){o.listeners.push(e)}};T.T===null?o.isTransition=!1:n(!0),r(o),n=t.pending,n===null?(o.next=t.pending=o,Qo(t,o)):(o.next=n.next,t.pending=n.next=o)}}function Qo(e,t){var n=t.action,r=t.payload,i=e.state;if(t.isTransition){var a=T.T,o={};T.T=o;try{var s=n(i,r),c=T.S;c!==null&&c(o,s),$o(e,t,s)}catch(n){ts(e,t,n)}finally{a!==null&&o.types!==null&&(a.types=o.types),T.T=a}}else try{a=n(i,r),$o(e,t,a)}catch(n){ts(e,t,n)}}function $o(e,t,n){typeof n==`object`&&n&&typeof n.then==`function`?n.then(function(n){es(e,t,n)},function(n){return ts(e,t,n)}):es(e,t,n)}function es(e,t,n){t.status=`fulfilled`,t.value=n,ns(t),e.state=n,t=e.pending,t!==null&&(n=t.next,n===t?e.pending=null:(n=n.next,t.next=n,Qo(e,n)))}function ts(e,t,n){var r=e.pending;if(e.pending=null,r!==null){r=r.next;do t.status=`rejected`,t.reason=n,ns(t),t=t.next;while(t!==r)}e.action=null}function ns(e){e=e.listeners;for(var t=0;t<e.length;t++)(0,e[t])()}function rs(e,t){return t}function is(e,t){if(M){var n=G.formState;if(n!==null){a:{var r=F;if(M){if(j){b:{for(var i=j,a=Ui;i.nodeType!==8;){if(!a){i=null;break b}if(i=cf(i.nextSibling),i===null){i=null;break b}}a=i.data,i=a===`F!`||a===`F`?i:null}if(i){j=cf(i.nextSibling),r=i.data===`F!`;break a}}Gi(r)}r=!1}r&&(t=n[0])}}return n=Po(),n.memoizedState=n.baseState=t,r={pending:null,lanes:0,dispatch:null,lastRenderedReducer:rs,lastRenderedState:t},n.queue=r,n=Is.bind(null,F,r),r.dispatch=n,r=Yo(!1),a=Rs.bind(null,F,!1,r.queue),r=Po(),i={state:t,dispatch:null,action:e,pending:null},r.queue=i,n=Zo.bind(null,F,i,a,n),i.dispatch=n,r.memoizedState=e,[t,n,!1]}function as(e){return os(z(),I,e)}function os(e,t,n){if(t=Vo(e,t,rs)[0],e=Bo(zo)[0],typeof t==`object`&&t&&typeof t.then==`function`)try{var r=Io(t)}catch(e){throw e===Oa?Aa:e}else r=t;t=z();var i=t.queue,a=i.dispatch;return n!==t.memoizedState&&(F.flags|=2048,ls(9,{destroy:void 0},ss.bind(null,i,n),null)),[r,a,e]}function ss(e,t){e.action=t}function cs(e){var t=z(),n=I;if(n!==null)return os(t,n,e);z(),t=t.memoizedState,n=z();var r=n.queue.dispatch;return n.memoizedState=e,[t,r,!1]}function ls(e,t,n,r){return e={tag:e,create:n,deps:r,inst:t,next:null},t=F.updateQueue,t===null&&(t=Fo(),F.updateQueue=t),n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e),e}function us(){return z().memoizedState}function ds(e,t,n,r){var i=Po();F.flags|=e,i.memoizedState=ls(1|t,{destroy:void 0},n,r===void 0?null:r)}function fs(e,t,n,r){var i=z();r=r===void 0?null:r;var a=i.memoizedState.inst;I!==null&&r!==null&&Eo(r,I.memoizedState.deps)?i.memoizedState=ls(t,a,n,r):(F.flags|=e,i.memoizedState=ls(1|t,a,n,r))}function ps(e,t){ds(8390656,8,e,t)}function ms(e,t){fs(2048,8,e,t)}function hs(e){F.flags|=4;var t=F.updateQueue;if(t===null)t=Fo(),F.updateQueue=t,t.events=[e];else{var n=t.events;n===null?t.events=[e]:n.push(e)}}function gs(e){var t=z().memoizedState;return hs({ref:t,nextImpl:e}),function(){if(W&2)throw Error(i(440));return t.impl.apply(void 0,arguments)}}function _s(e,t){return fs(4,2,e,t)}function vs(e,t){return fs(4,4,e,t)}function ys(e,t){if(typeof t==`function`){e=e();var n=t(e);return function(){typeof n==`function`?n():t(null)}}if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function bs(e,t,n){n=n==null?null:n.concat([e]),fs(4,4,ys.bind(null,t,e),n)}function xs(){}function Ss(e,t){var n=z();t=t===void 0?null:t;var r=n.memoizedState;return t!==null&&Eo(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function Cs(e,t){var n=z();t=t===void 0?null:t;var r=n.memoizedState;if(t!==null&&Eo(t,r[1]))return r[0];if(r=e(),xo){Ge(!0);try{e()}finally{Ge(!1)}}return n.memoizedState=[r,t],r}function ws(e,t,n){return n===void 0||vo&1073741824&&!(q&261930)?e.memoizedState=t:(e.memoizedState=n,e=mu(),F.lanes|=e,Kl|=e,n)}function Ts(e,t,n,r){return Ar(n,t)?n:io.current===null?!(vo&42)||vo&1073741824&&!(q&261930)?(B=!0,e.memoizedState=n):(e=mu(),F.lanes|=e,Kl|=e,t):(e=ws(e,n,r),Ar(e,t)||(B=!0),e)}function Es(e,t,n,r,i){var a=E.p;E.p=a!==0&&8>a?a:8;var o=T.T,s={};T.T=s,Rs(e,!1,t,n);try{var c=i(),l=T.S;l!==null&&l(s,c),typeof c==`object`&&c&&typeof c.then==`function`?Ls(e,t,Sa(c,r),pu(e)):Ls(e,t,r,pu(e))}catch(n){Ls(e,t,{then:function(){},status:`rejected`,reason:n},pu())}finally{E.p=a,o!==null&&s.types!==null&&(o.types=s.types),T.T=o}}function Ds(){}function Os(e,t,n,r){if(e.tag!==5)throw Error(i(476));var a=ks(e).queue;Es(e,a,t,de,n===null?Ds:function(){return As(e),n(r)})}function ks(e){var t=e.memoizedState;if(t!==null)return t;t={memoizedState:de,baseState:de,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:zo,lastRenderedState:de},next:null};var n={};return t.next={memoizedState:n,baseState:n,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:zo,lastRenderedState:n},next:null},e.memoizedState=t,e=e.alternate,e!==null&&(e.memoizedState=t),t}function As(e){var t=ks(e);t.next===null&&(t=e.alternate.memoizedState),Ls(e,t.next.queue,{},pu())}function js(){return ca(Qf)}function Ms(){return z().memoizedState}function Ns(){return z().memoizedState}function Ps(e){for(var t=e.return;t!==null;){switch(t.tag){case 24:case 3:var n=pu();e=Ya(n);var r=Xa(t,e,n);r!==null&&(hu(r,t,n),Za(r,t,n)),t={cache:ma()},e.payload=t;return}t=t.return}}function Fs(e,t,n){var r=pu();n={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null},zs(e)?Bs(t,n):(n=ui(e,t,n,r),n!==null&&(hu(n,e,r),Vs(n,t,r)))}function Is(e,t,n){Ls(e,t,n,pu())}function Ls(e,t,n,r){var i={lane:r,revertLane:0,gesture:null,action:n,hasEagerState:!1,eagerState:null,next:null};if(zs(e))Bs(t,i);else{var a=e.alternate;if(e.lanes===0&&(a===null||a.lanes===0)&&(a=t.lastRenderedReducer,a!==null))try{var o=t.lastRenderedState,s=a(o,n);if(i.hasEagerState=!0,i.eagerState=s,Ar(s,o))return li(e,t,i,0),G===null&&ci(),!1}catch{}if(n=ui(e,t,i,r),n!==null)return hu(n,e,r),Vs(n,t,r),!0}return!1}function Rs(e,t,n,r){if(r={lane:2,revertLane:dd(),gesture:null,action:r,hasEagerState:!1,eagerState:null,next:null},zs(e)){if(t)throw Error(i(479))}else t=ui(e,n,r,2),t!==null&&hu(t,e,2)}function zs(e){var t=e.alternate;return e===F||t!==null&&t===F}function Bs(e,t){bo=yo=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function Vs(e,t,n){if(n&4194048){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,ct(e,n)}}var Hs={readContext:ca,use:Lo,useCallback:R,useContext:R,useEffect:R,useImperativeHandle:R,useLayoutEffect:R,useInsertionEffect:R,useMemo:R,useReducer:R,useRef:R,useState:R,useDebugValue:R,useDeferredValue:R,useTransition:R,useSyncExternalStore:R,useId:R,useHostTransitionStatus:R,useFormState:R,useActionState:R,useOptimistic:R,useMemoCache:R,useCacheRefresh:R};Hs.useEffectEvent=R;var Us={readContext:ca,use:Lo,useCallback:function(e,t){return Po().memoizedState=[e,t===void 0?null:t],e},useContext:ca,useEffect:ps,useImperativeHandle:function(e,t,n){n=n==null?null:n.concat([e]),ds(4194308,4,ys.bind(null,t,e),n)},useLayoutEffect:function(e,t){return ds(4194308,4,e,t)},useInsertionEffect:function(e,t){ds(4,2,e,t)},useMemo:function(e,t){var n=Po();t=t===void 0?null:t;var r=e();if(xo){Ge(!0);try{e()}finally{Ge(!1)}}return n.memoizedState=[r,t],r},useReducer:function(e,t,n){var r=Po();if(n!==void 0){var i=n(t);if(xo){Ge(!0);try{n(t)}finally{Ge(!1)}}}else i=t;return r.memoizedState=r.baseState=i,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:i},r.queue=e,e=e.dispatch=Fs.bind(null,F,e),[r.memoizedState,e]},useRef:function(e){var t=Po();return e={current:e},t.memoizedState=e},useState:function(e){e=Yo(e);var t=e.queue,n=Is.bind(null,F,t);return t.dispatch=n,[e.memoizedState,n]},useDebugValue:xs,useDeferredValue:function(e,t){return ws(Po(),e,t)},useTransition:function(){var e=Yo(!1);return e=Es.bind(null,F,e.queue,!0,!1),Po().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,t,n){var r=F,a=Po();if(M){if(n===void 0)throw Error(i(407));n=n()}else{if(n=t(),G===null)throw Error(i(349));q&127||Wo(r,t,n)}a.memoizedState=n;var o={value:n,getSnapshot:t};return a.queue=o,ps(Ko.bind(null,r,o,e),[e]),r.flags|=2048,ls(9,{destroy:void 0},Go.bind(null,r,o,n,t),null),n},useId:function(){var e=Po(),t=G.identifierPrefix;if(M){var n=Fi,r=Pi;n=(r&~(1<<32-Ke(r)-1)).toString(32)+n,t=`_`+t+`R_`+n,n=So++,0<n&&(t+=`H`+n.toString(32)),t+=`_`}else n=To++,t=`_`+t+`r_`+n.toString(32)+`_`;return e.memoizedState=t},useHostTransitionStatus:js,useFormState:is,useActionState:is,useOptimistic:function(e){var t=Po();t.memoizedState=t.baseState=e;var n={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return t.queue=n,t=Rs.bind(null,F,!0,n),n.dispatch=t,[e,t]},useMemoCache:Ro,useCacheRefresh:function(){return Po().memoizedState=Ps.bind(null,F)},useEffectEvent:function(e){var t=Po(),n={impl:e};return t.memoizedState=n,function(){if(W&2)throw Error(i(440));return n.impl.apply(void 0,arguments)}}},Ws={readContext:ca,use:Lo,useCallback:Ss,useContext:ca,useEffect:ms,useImperativeHandle:bs,useInsertionEffect:_s,useLayoutEffect:vs,useMemo:Cs,useReducer:Bo,useRef:us,useState:function(){return Bo(zo)},useDebugValue:xs,useDeferredValue:function(e,t){return Ts(z(),I.memoizedState,e,t)},useTransition:function(){var e=Bo(zo)[0],t=z().memoizedState;return[typeof e==`boolean`?e:Io(e),t]},useSyncExternalStore:Uo,useId:Ms,useHostTransitionStatus:js,useFormState:as,useActionState:as,useOptimistic:function(e,t){return Xo(z(),I,e,t)},useMemoCache:Ro,useCacheRefresh:Ns};Ws.useEffectEvent=gs;var Gs={readContext:ca,use:Lo,useCallback:Ss,useContext:ca,useEffect:ms,useImperativeHandle:bs,useInsertionEffect:_s,useLayoutEffect:vs,useMemo:Cs,useReducer:Ho,useRef:us,useState:function(){return Ho(zo)},useDebugValue:xs,useDeferredValue:function(e,t){var n=z();return I===null?ws(n,e,t):Ts(n,I.memoizedState,e,t)},useTransition:function(){var e=Ho(zo)[0],t=z().memoizedState;return[typeof e==`boolean`?e:Io(e),t]},useSyncExternalStore:Uo,useId:Ms,useHostTransitionStatus:js,useFormState:cs,useActionState:cs,useOptimistic:function(e,t){var n=z();return I===null?(n.baseState=e,[e,n.queue.dispatch]):Xo(n,I,e,t)},useMemoCache:Ro,useCacheRefresh:Ns};Gs.useEffectEvent=gs;function Ks(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:h({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var qs={enqueueSetState:function(e,t,n){e=e._reactInternals;var r=pu(),i=Ya(r);i.payload=t,n!=null&&(i.callback=n),t=Xa(e,i,r),t!==null&&(hu(t,e,r),Za(t,e,r))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=pu(),i=Ya(r);i.tag=1,i.payload=t,n!=null&&(i.callback=n),t=Xa(e,i,r),t!==null&&(hu(t,e,r),Za(t,e,r))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=pu(),r=Ya(n);r.tag=2,t!=null&&(r.callback=t),t=Xa(e,r,n),t!==null&&(hu(t,e,n),Za(t,e,n))}};function Js(e,t,n,r,i,a,o){return e=e.stateNode,typeof e.shouldComponentUpdate==`function`?e.shouldComponentUpdate(r,a,o):t.prototype&&t.prototype.isPureReactComponent?!jr(n,r)||!jr(i,a):!0}function Ys(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps==`function`&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps==`function`&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&qs.enqueueReplaceState(t,t.state,null)}function Xs(e,t){var n=t;if(`ref`in t)for(var r in n={},t)r!==`ref`&&(n[r]=t[r]);if(e=e.defaultProps)for(var i in n===t&&(n=h({},n)),e)n[i]===void 0&&(n[i]=e[i]);return n}function Zs(e){ii(e)}function Qs(e){console.error(e)}function $s(e){ii(e)}function ec(e,t){try{var n=e.onUncaughtError;n(t.value,{componentStack:t.stack})}catch(e){setTimeout(function(){throw e})}}function tc(e,t,n){try{var r=e.onCaughtError;r(n.value,{componentStack:n.stack,errorBoundary:t.tag===1?t.stateNode:null})}catch(e){setTimeout(function(){throw e})}}function nc(e,t,n){return n=Ya(n),n.tag=3,n.payload={element:null},n.callback=function(){ec(e,t)},n}function rc(e){return e=Ya(e),e.tag=3,e}function ic(e,t,n,r){var i=n.type.getDerivedStateFromError;if(typeof i==`function`){var a=r.value;e.payload=function(){return i(a)},e.callback=function(){tc(t,n,r)}}var o=n.stateNode;o!==null&&typeof o.componentDidCatch==`function`&&(e.callback=function(){tc(t,n,r),typeof i!=`function`&&(iu===null?iu=new Set([this]):iu.add(this));var e=r.stack;this.componentDidCatch(r.value,{componentStack:e===null?``:e})})}function ac(e,t,n,r,a){if(n.flags|=32768,typeof r==`object`&&r&&typeof r.then==`function`){if(t=n.alternate,t!==null&&aa(t,n,a,!0),n=lo.current,n!==null){switch(n.tag){case 31:case 13:return uo===null?Du():n.alternate===null&&Y===0&&(Y=3),n.flags&=-257,n.flags|=65536,n.lanes=a,r===ja?n.flags|=16384:(t=n.updateQueue,t===null?n.updateQueue=new Set([r]):t.add(r),Gu(e,r,a)),!1;case 22:return n.flags|=65536,r===ja?n.flags|=16384:(t=n.updateQueue,t===null?(t={transitions:null,markerInstances:null,retryQueue:new Set([r])},n.updateQueue=t):(n=t.retryQueue,n===null?t.retryQueue=new Set([r]):n.add(r)),Gu(e,r,a)),!1}throw Error(i(435,n.tag))}return Gu(e,r,a),Du(),!1}if(M)return t=lo.current,t===null?(r!==Wi&&(t=Error(i(423),{cause:r}),Zi(Ei(t,n))),e=e.current.alternate,e.flags|=65536,a&=-a,e.lanes|=a,r=Ei(r,n),a=nc(e.stateNode,r,a),Qa(e,a),Y!==4&&(Y=2)):(!(t.flags&65536)&&(t.flags|=256),t.flags|=65536,t.lanes=a,r!==Wi&&(e=Error(i(422),{cause:r}),Zi(Ei(e,n)))),!1;var o=Error(i(520),{cause:r});if(o=Ei(o,n),Zl===null?Zl=[o]:Zl.push(o),Y!==4&&(Y=2),t===null)return!0;r=Ei(r,n),n=t;do{switch(n.tag){case 3:return n.flags|=65536,e=a&-a,n.lanes|=e,e=nc(n.stateNode,r,e),Qa(n,e),!1;case 1:if(t=n.type,o=n.stateNode,!(n.flags&128)&&(typeof t.getDerivedStateFromError==`function`||o!==null&&typeof o.componentDidCatch==`function`&&(iu===null||!iu.has(o))))return n.flags|=65536,a&=-a,n.lanes|=a,a=rc(a),ic(a,e,n,r),Qa(n,a),!1}n=n.return}while(n!==null);return!1}var oc=Error(i(461)),B=!1;function sc(e,t,n,r){t.child=e===null?Ga(t,null,n,r):Wa(t,e.child,n,r)}function cc(e,t,n,r,i){n=n.render;var a=t.ref;if(`ref`in r){var o={};for(var s in r)s!==`ref`&&(o[s]=r[s])}else o=r;return sa(t),r=Do(e,t,n,o,a,i),s=jo(),e!==null&&!B?(Mo(e,t,i),Mc(e,t,i)):(M&&s&&Ri(t),t.flags|=1,sc(e,t,r,i),t.child)}function lc(e,t,n,r,i){if(e===null){var a=n.type;return typeof a==`function`&&!_i(a)&&a.defaultProps===void 0&&n.compare===null?(t.tag=15,t.type=a,uc(e,t,a,r,i)):(e=bi(n.type,null,r,t,t.mode,i),e.ref=t.ref,e.return=t,t.child=e)}if(a=e.child,!Nc(e,i)){var o=a.memoizedProps;if(n=n.compare,n=n===null?jr:n,n(o,r)&&e.ref===t.ref)return Mc(e,t,i)}return t.flags|=1,e=vi(a,r),e.ref=t.ref,e.return=t,t.child=e}function uc(e,t,n,r,i){if(e!==null){var a=e.memoizedProps;if(jr(a,r)&&e.ref===t.ref)if(B=!1,t.pendingProps=r=a,Nc(e,i))e.flags&131072&&(B=!0);else return t.lanes=e.lanes,Mc(e,t,i)}return vc(e,t,n,r,i)}function dc(e,t,n,r){var i=r.children,a=e===null?null:e.memoizedState;if(e===null&&t.stateNode===null&&(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),r.mode===`hidden`){if(t.flags&128){if(a=a===null?n:a.baseLanes|n,e!==null){for(r=t.child=e.child,i=0;r!==null;)i=i|r.lanes|r.childLanes,r=r.sibling;r=i&~a}else r=0,t.child=null;return pc(e,t,a,n,r)}if(n&536870912)t.memoizedState={baseLanes:0,cachePool:null},e!==null&&Ea(t,a===null?null:a.cachePool),a===null?so():oo(t,a),mo(t);else return r=t.lanes=536870912,pc(e,t,a===null?n:a.baseLanes|n,n,r)}else a===null?(e!==null&&Ea(t,null),so(),ho(t)):(Ea(t,a.cachePool),oo(t,a),ho(t),t.memoizedState=null);return sc(e,t,i,n),t.child}function fc(e,t){return e!==null&&e.tag===22||t.stateNode!==null||(t.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),t.sibling}function pc(e,t,n,r,i){var a=Ta();return a=a===null?null:{parent:N._currentValue,pool:a},t.memoizedState={baseLanes:n,cachePool:a},e!==null&&Ea(t,null),so(),mo(t),e!==null&&aa(e,t,r,!0),t.childLanes=i,null}function mc(e,t){return t=Dc({mode:t.mode,children:t.children},e.mode),t.ref=e.ref,e.child=t,t.return=e,t}function hc(e,t,n){return Wa(t,e.child,null,n),e=mc(t,t.pendingProps),e.flags|=2,go(t),t.memoizedState=null,e}function gc(e,t,n){var r=t.pendingProps,a=(t.flags&128)!=0;if(t.flags&=-129,e===null){if(M){if(r.mode===`hidden`)return e=mc(t,r),t.lanes=536870912,fc(null,e);if(po(t),(e=j)?(e=rf(e,Ui),e=e!==null&&e.data===`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ni===null?null:{id:Pi,overflow:Fi},retryLane:536870912,hydrationErrors:null},n=Ci(e),n.return=t,t.child=n,Vi=t,j=null)):e=null,e===null)throw Gi(t);return t.lanes=536870912,null}return mc(t,r)}var o=e.memoizedState;if(o!==null){var s=o.dehydrated;if(po(t),a)if(t.flags&256)t.flags&=-257,t=hc(e,t,n);else if(t.memoizedState!==null)t.child=e.child,t.flags|=128,t=null;else throw Error(i(558));else if(B||aa(e,t,n,!1),a=(n&e.childLanes)!==0,B||a){if(r=G,r!==null&&(s=lt(r,n),s!==0&&s!==o.retryLane))throw o.retryLane=s,di(e,s),hu(r,e,s),oc;Du(),t=hc(e,t,n)}else e=o.treeContext,j=cf(s.nextSibling),Vi=t,M=!0,Hi=null,Ui=!1,e!==null&&Bi(t,e),t=mc(t,r),t.flags|=4096;return t}return e=vi(e.child,{mode:r.mode,children:r.children}),e.ref=t.ref,t.child=e,e.return=t,e}function _c(e,t){var n=t.ref;if(n===null)e!==null&&e.ref!==null&&(t.flags|=4194816);else{if(typeof n!=`function`&&typeof n!=`object`)throw Error(i(284));(e===null||e.ref!==n)&&(t.flags|=4194816)}}function vc(e,t,n,r,i){return sa(t),n=Do(e,t,n,r,void 0,i),r=jo(),e!==null&&!B?(Mo(e,t,i),Mc(e,t,i)):(M&&r&&Ri(t),t.flags|=1,sc(e,t,n,i),t.child)}function yc(e,t,n,r,i,a){return sa(t),t.updateQueue=null,n=ko(t,r,n,i),Oo(e),r=jo(),e!==null&&!B?(Mo(e,t,a),Mc(e,t,a)):(M&&r&&Ri(t),t.flags|=1,sc(e,t,n,a),t.child)}function bc(e,t,n,r,i){if(sa(t),t.stateNode===null){var a=mi,o=n.contextType;typeof o==`object`&&o&&(a=ca(o)),a=new n(r,a),t.memoizedState=a.state!==null&&a.state!==void 0?a.state:null,a.updater=qs,t.stateNode=a,a._reactInternals=t,a=t.stateNode,a.props=r,a.state=t.memoizedState,a.refs={},qa(t),o=n.contextType,a.context=typeof o==`object`&&o?ca(o):mi,a.state=t.memoizedState,o=n.getDerivedStateFromProps,typeof o==`function`&&(Ks(t,n,o,r),a.state=t.memoizedState),typeof n.getDerivedStateFromProps==`function`||typeof a.getSnapshotBeforeUpdate==`function`||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(o=a.state,typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount(),o!==a.state&&qs.enqueueReplaceState(a,a.state,null),to(t,r,a,i),eo(),a.state=t.memoizedState),typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!0}else if(e===null){a=t.stateNode;var s=t.memoizedProps,c=Xs(n,s);a.props=c;var l=a.context,u=n.contextType;o=mi,typeof u==`object`&&u&&(o=ca(u));var d=n.getDerivedStateFromProps;u=typeof d==`function`||typeof a.getSnapshotBeforeUpdate==`function`,s=t.pendingProps!==s,u||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(s||l!==o)&&Ys(t,a,r,o),Ka=!1;var f=t.memoizedState;a.state=f,to(t,r,a,i),eo(),l=t.memoizedState,s||f!==l||Ka?(typeof d==`function`&&(Ks(t,n,d,r),l=t.memoizedState),(c=Ka||Js(t,n,c,r,f,l,o))?(u||typeof a.UNSAFE_componentWillMount!=`function`&&typeof a.componentWillMount!=`function`||(typeof a.componentWillMount==`function`&&a.componentWillMount(),typeof a.UNSAFE_componentWillMount==`function`&&a.UNSAFE_componentWillMount()),typeof a.componentDidMount==`function`&&(t.flags|=4194308)):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=l),a.props=r,a.state=l,a.context=o,r=c):(typeof a.componentDidMount==`function`&&(t.flags|=4194308),r=!1)}else{a=t.stateNode,Ja(e,t),o=t.memoizedProps,u=Xs(n,o),a.props=u,d=t.pendingProps,f=a.context,l=n.contextType,c=mi,typeof l==`object`&&l&&(c=ca(l)),s=n.getDerivedStateFromProps,(l=typeof s==`function`||typeof a.getSnapshotBeforeUpdate==`function`)||typeof a.UNSAFE_componentWillReceiveProps!=`function`&&typeof a.componentWillReceiveProps!=`function`||(o!==d||f!==c)&&Ys(t,a,r,c),Ka=!1,f=t.memoizedState,a.state=f,to(t,r,a,i),eo();var p=t.memoizedState;o!==d||f!==p||Ka||e!==null&&e.dependencies!==null&&oa(e.dependencies)?(typeof s==`function`&&(Ks(t,n,s,r),p=t.memoizedState),(u=Ka||Js(t,n,u,r,f,p,c)||e!==null&&e.dependencies!==null&&oa(e.dependencies))?(l||typeof a.UNSAFE_componentWillUpdate!=`function`&&typeof a.componentWillUpdate!=`function`||(typeof a.componentWillUpdate==`function`&&a.componentWillUpdate(r,p,c),typeof a.UNSAFE_componentWillUpdate==`function`&&a.UNSAFE_componentWillUpdate(r,p,c)),typeof a.componentDidUpdate==`function`&&(t.flags|=4),typeof a.getSnapshotBeforeUpdate==`function`&&(t.flags|=1024)):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=p),a.props=r,a.state=p,a.context=c,r=u):(typeof a.componentDidUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=4),typeof a.getSnapshotBeforeUpdate!=`function`||o===e.memoizedProps&&f===e.memoizedState||(t.flags|=1024),r=!1)}return a=r,_c(e,t),r=(t.flags&128)!=0,a||r?(a=t.stateNode,n=r&&typeof n.getDerivedStateFromError!=`function`?null:a.render(),t.flags|=1,e!==null&&r?(t.child=Wa(t,e.child,null,i),t.child=Wa(t,null,n,i)):sc(e,t,n,i),t.memoizedState=a.state,e=t.child):e=Mc(e,t,i),e}function xc(e,t,n,r){return Yi(),t.flags|=256,sc(e,t,n,r),t.child}var Sc={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Cc(e){return{baseLanes:e,cachePool:Da()}}function wc(e,t,n){return e=e===null?0:e.childLanes&~n,t&&(e|=Yl),e}function Tc(e,t,n){var r=t.pendingProps,a=!1,o=(t.flags&128)!=0,s;if((s=o)||(s=e!==null&&e.memoizedState===null?!1:(P.current&2)!=0),s&&(a=!0,t.flags&=-129),s=(t.flags&32)!=0,t.flags&=-33,e===null){if(M){if(a?fo(t):ho(t),(e=j)?(e=rf(e,Ui),e=e!==null&&e.data!==`&`?e:null,e!==null&&(t.memoizedState={dehydrated:e,treeContext:Ni===null?null:{id:Pi,overflow:Fi},retryLane:536870912,hydrationErrors:null},n=Ci(e),n.return=t,t.child=n,Vi=t,j=null)):e=null,e===null)throw Gi(t);return of(e)?t.lanes=32:t.lanes=536870912,null}var c=r.children;return r=r.fallback,a?(ho(t),a=t.mode,c=Dc({mode:`hidden`,children:c},a),r=xi(r,a,n,null),c.return=t,r.return=t,c.sibling=r,t.child=c,r=t.child,r.memoizedState=Cc(n),r.childLanes=wc(e,s,n),t.memoizedState=Sc,fc(null,r)):(fo(t),Ec(t,c))}var l=e.memoizedState;if(l!==null&&(c=l.dehydrated,c!==null)){if(o)t.flags&256?(fo(t),t.flags&=-257,t=Oc(e,t,n)):t.memoizedState===null?(ho(t),c=r.fallback,a=t.mode,r=Dc({mode:`visible`,children:r.children},a),c=xi(c,a,n,null),c.flags|=2,r.return=t,c.return=t,r.sibling=c,t.child=r,Wa(t,e.child,null,n),r=t.child,r.memoizedState=Cc(n),r.childLanes=wc(e,s,n),t.memoizedState=Sc,t=fc(null,r)):(ho(t),t.child=e.child,t.flags|=128,t=null);else if(fo(t),of(c)){if(s=c.nextSibling&&c.nextSibling.dataset,s)var u=s.dgst;s=u,r=Error(i(419)),r.stack=``,r.digest=s,Zi({value:r,source:null,stack:null}),t=Oc(e,t,n)}else if(B||aa(e,t,n,!1),s=(n&e.childLanes)!==0,B||s){if(s=G,s!==null&&(r=lt(s,n),r!==0&&r!==l.retryLane))throw l.retryLane=r,di(e,r),hu(s,e,r),oc;af(c)||Du(),t=Oc(e,t,n)}else af(c)?(t.flags|=192,t.child=e.child,t=null):(e=l.treeContext,j=cf(c.nextSibling),Vi=t,M=!0,Hi=null,Ui=!1,e!==null&&Bi(t,e),t=Ec(t,r.children),t.flags|=4096);return t}return a?(ho(t),c=r.fallback,a=t.mode,l=e.child,u=l.sibling,r=vi(l,{mode:`hidden`,children:r.children}),r.subtreeFlags=l.subtreeFlags&65011712,u===null?(c=xi(c,a,n,null),c.flags|=2):c=vi(u,c),c.return=t,r.return=t,r.sibling=c,t.child=r,fc(null,r),r=t.child,c=e.child.memoizedState,c===null?c=Cc(n):(a=c.cachePool,a===null?a=Da():(l=N._currentValue,a=a.parent===l?a:{parent:l,pool:l}),c={baseLanes:c.baseLanes|n,cachePool:a}),r.memoizedState=c,r.childLanes=wc(e,s,n),t.memoizedState=Sc,fc(e.child,r)):(fo(t),n=e.child,e=n.sibling,n=vi(n,{mode:`visible`,children:r.children}),n.return=t,n.sibling=null,e!==null&&(s=t.deletions,s===null?(t.deletions=[e],t.flags|=16):s.push(e)),t.child=n,t.memoizedState=null,n)}function Ec(e,t){return t=Dc({mode:`visible`,children:t},e.mode),t.return=e,e.child=t}function Dc(e,t){return e=gi(22,e,null,t),e.lanes=0,e}function Oc(e,t,n){return Wa(t,e.child,null,n),e=Ec(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function kc(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),ra(e.return,t,n)}function Ac(e,t,n,r,i,a){var o=e.memoizedState;o===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:i,treeForkCount:a}:(o.isBackwards=t,o.rendering=null,o.renderingStartTime=0,o.last=r,o.tail=n,o.tailMode=i,o.treeForkCount=a)}function jc(e,t,n){var r=t.pendingProps,i=r.revealOrder,a=r.tail;r=r.children;var o=P.current,s=(o&2)!=0;if(s?(o=o&1|2,t.flags|=128):o&=1,k(P,o),sc(e,t,r,n),r=M?Ai:0,!s&&e!==null&&e.flags&128)a:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&kc(e,n,t);else if(e.tag===19)kc(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break a;for(;e.sibling===null;){if(e.return===null||e.return===t)break a;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(i){case`forwards`:for(n=t.child,i=null;n!==null;)e=n.alternate,e!==null&&_o(e)===null&&(i=n),n=n.sibling;n=i,n===null?(i=t.child,t.child=null):(i=n.sibling,n.sibling=null),Ac(t,!1,i,n,a,r);break;case`backwards`:case`unstable_legacy-backwards`:for(n=null,i=t.child,t.child=null;i!==null;){if(e=i.alternate,e!==null&&_o(e)===null){t.child=i;break}e=i.sibling,i.sibling=n,n=i,i=e}Ac(t,!0,n,null,a,r);break;case`together`:Ac(t,!1,null,null,void 0,r);break;default:t.memoizedState=null}return t.child}function Mc(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),Kl|=t.lanes,(n&t.childLanes)===0)if(e!==null){if(aa(e,t,n,!1),(n&t.childLanes)===0)return null}else return null;if(e!==null&&t.child!==e.child)throw Error(i(153));if(t.child!==null){for(e=t.child,n=vi(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=vi(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Nc(e,t){return(e.lanes&t)===0?(e=e.dependencies,!!(e!==null&&oa(e))):!0}function Pc(e,t,n){switch(t.tag){case 3:ve(t,t.stateNode.containerInfo),ta(t,N,e.memoizedState.cache),Yi();break;case 27:case 5:be(t);break;case 4:ve(t,t.stateNode.containerInfo);break;case 10:ta(t,t.type,t.memoizedProps.value);break;case 31:if(t.memoizedState!==null)return t.flags|=128,po(t),null;break;case 13:var r=t.memoizedState;if(r!==null)return r.dehydrated===null?(n&t.child.childLanes)===0?(fo(t),e=Mc(e,t,n),e===null?null:e.sibling):Tc(e,t,n):(fo(t),t.flags|=128,null);fo(t);break;case 19:var i=(e.flags&128)!=0;if(r=(n&t.childLanes)!==0,r||=(aa(e,t,n,!1),(n&t.childLanes)!==0),i){if(r)return jc(e,t,n);t.flags|=128}if(i=t.memoizedState,i!==null&&(i.rendering=null,i.tail=null,i.lastEffect=null),k(P,P.current),r)break;return null;case 22:return t.lanes=0,dc(e,t,n,t.pendingProps);case 24:ta(t,N,e.memoizedState.cache)}return Mc(e,t,n)}function Fc(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps)B=!0;else{if(!Nc(e,n)&&!(t.flags&128))return B=!1,Pc(e,t,n);B=!!(e.flags&131072)}else B=!1,M&&t.flags&1048576&&Li(t,Ai,t.index);switch(t.lanes=0,t.tag){case 16:a:{var r=t.pendingProps;if(e=Pa(t.elementType),t.type=e,typeof e==`function`)_i(e)?(r=Xs(e,r),t.tag=1,t=bc(null,t,e,r,n)):(t.tag=0,t=vc(null,t,e,r,n));else{if(e!=null){var a=e.$$typeof;if(a===C){t.tag=11,t=cc(null,t,e,r,n);break a}else if(a===re){t.tag=14,t=lc(null,t,e,r,n);break a}}throw t=le(e)||e,Error(i(306,t,``))}}return t;case 0:return vc(e,t,t.type,t.pendingProps,n);case 1:return r=t.type,a=Xs(r,t.pendingProps),bc(e,t,r,a,n);case 3:a:{if(ve(t,t.stateNode.containerInfo),e===null)throw Error(i(387));r=t.pendingProps;var o=t.memoizedState;a=o.element,Ja(e,t),to(t,r,null,n);var s=t.memoizedState;if(r=s.cache,ta(t,N,r),r!==o.cache&&ia(t,[N],n,!0),eo(),r=s.element,o.isDehydrated)if(o={element:r,isDehydrated:!1,cache:s.cache},t.updateQueue.baseState=o,t.memoizedState=o,t.flags&256){t=xc(e,t,r,n);break a}else if(r!==a){a=Ei(Error(i(424)),t),Zi(a),t=xc(e,t,r,n);break a}else{switch(e=t.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName===`HTML`?e.ownerDocument.body:e}for(j=cf(e.firstChild),Vi=t,M=!0,Hi=null,Ui=!0,n=Ga(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling}else{if(Yi(),r===a){t=Mc(e,t,n);break a}sc(e,t,r,n)}t=t.child}return t;case 26:return _c(e,t),e===null?(n=kf(t.type,null,t.pendingProps,null))?t.memoizedState=n:M||(n=t.type,e=t.pendingProps,r=Bd(ge.current).createElement(n),r[ht]=t,r[gt]=e,Pd(r,n,e),A(r),t.stateNode=r):t.memoizedState=kf(t.type,e.memoizedProps,t.pendingProps,e.memoizedState),null;case 27:return be(t),e===null&&M&&(r=t.stateNode=ff(t.type,t.pendingProps,ge.current),Vi=t,Ui=!0,a=j,Zd(t.type)?(lf=a,j=cf(r.firstChild)):j=a),sc(e,t,t.pendingProps.children,n),_c(e,t),e===null&&(t.flags|=4194304),t.child;case 5:return e===null&&M&&((a=r=j)&&(r=tf(r,t.type,t.pendingProps,Ui),r===null?a=!1:(t.stateNode=r,Vi=t,j=cf(r.firstChild),Ui=!1,a=!0)),a||Gi(t)),be(t),a=t.type,o=t.pendingProps,s=e===null?null:e.memoizedProps,r=o.children,Ud(a,o)?r=null:s!==null&&Ud(a,s)&&(t.flags|=32),t.memoizedState!==null&&(a=Do(e,t,Ao,null,null,n),Qf._currentValue=a),_c(e,t),sc(e,t,r,n),t.child;case 6:return e===null&&M&&((e=n=j)&&(n=nf(n,t.pendingProps,Ui),n===null?e=!1:(t.stateNode=n,Vi=t,j=null,e=!0)),e||Gi(t)),null;case 13:return Tc(e,t,n);case 4:return ve(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=Wa(t,null,r,n):sc(e,t,r,n),t.child;case 11:return cc(e,t,t.type,t.pendingProps,n);case 7:return sc(e,t,t.pendingProps,n),t.child;case 8:return sc(e,t,t.pendingProps.children,n),t.child;case 12:return sc(e,t,t.pendingProps.children,n),t.child;case 10:return r=t.pendingProps,ta(t,t.type,r.value),sc(e,t,r.children,n),t.child;case 9:return a=t.type._context,r=t.pendingProps.children,sa(t),a=ca(a),r=r(a),t.flags|=1,sc(e,t,r,n),t.child;case 14:return lc(e,t,t.type,t.pendingProps,n);case 15:return uc(e,t,t.type,t.pendingProps,n);case 19:return jc(e,t,n);case 31:return gc(e,t,n);case 22:return dc(e,t,n,t.pendingProps);case 24:return sa(t),r=ca(N),e===null?(a=Ta(),a===null&&(a=G,o=ma(),a.pooledCache=o,o.refCount++,o!==null&&(a.pooledCacheLanes|=n),a=o),t.memoizedState={parent:r,cache:a},qa(t),ta(t,N,a)):((e.lanes&n)!==0&&(Ja(e,t),to(t,null,null,n),eo()),a=e.memoizedState,o=t.memoizedState,a.parent===r?(r=o.cache,ta(t,N,r),r!==a.cache&&ia(t,[N],n,!0)):(a={parent:r,cache:r},t.memoizedState=a,t.lanes===0&&(t.memoizedState=t.updateQueue.baseState=a),ta(t,N,r))),sc(e,t,t.pendingProps.children,n),t.child;case 29:throw t.pendingProps}throw Error(i(156,t.tag))}function Ic(e){e.flags|=4}function Lc(e,t,n,r,i){if((t=(e.mode&32)!=0)&&(t=!1),t){if(e.flags|=16777216,(i&335544128)===i)if(e.stateNode.complete)e.flags|=8192;else if(wu())e.flags|=8192;else throw Fa=ja,ka}else e.flags&=-16777217}function Rc(e,t){if(t.type!==`stylesheet`||t.state.loading&4)e.flags&=-16777217;else if(e.flags|=16777216,!Wf(t))if(wu())e.flags|=8192;else throw Fa=ja,ka}function zc(e,t){t!==null&&(e.flags|=4),e.flags&16384&&(t=e.tag===22?536870912:rt(),e.lanes|=t,Xl|=t)}function Bc(e,t){if(!M)switch(e.tailMode){case`hidden`:t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case`collapsed`:n=e.tail;for(var r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null}}function V(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags&65011712,r|=i.flags&65011712,i.return=e,i=i.sibling;else for(i=e.child;i!==null;)n|=i.lanes|i.childLanes,r|=i.subtreeFlags,r|=i.flags,i.return=e,i=i.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function Vc(e,t,n){var r=t.pendingProps;switch(zi(t),t.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return V(t),null;case 1:return V(t),null;case 3:return n=t.stateNode,r=null,e!==null&&(r=e.memoizedState.cache),t.memoizedState.cache!==r&&(t.flags|=2048),na(N),ye(),n.pendingContext&&(n.context=n.pendingContext,n.pendingContext=null),(e===null||e.child===null)&&(Ji(t)?Ic(t):e===null||e.memoizedState.isDehydrated&&!(t.flags&256)||(t.flags|=1024,Xi())),V(t),null;case 26:var a=t.type,o=t.memoizedState;return e===null?(Ic(t),o===null?(V(t),Lc(t,a,null,r,n)):(V(t),Rc(t,o))):o?o===e.memoizedState?(V(t),t.flags&=-16777217):(Ic(t),V(t),Rc(t,o)):(e=e.memoizedProps,e!==r&&Ic(t),V(t),Lc(t,a,e,r,n)),null;case 27:if(xe(t),n=ge.current,a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&Ic(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return V(t),null}e=me.current,Ji(t)?Ki(t,e):(e=ff(a,r,n),t.stateNode=e,Ic(t))}return V(t),null;case 5:if(xe(t),a=t.type,e!==null&&t.stateNode!=null)e.memoizedProps!==r&&Ic(t);else{if(!r){if(t.stateNode===null)throw Error(i(166));return V(t),null}if(o=me.current,Ji(t))Ki(t,o);else{var s=Bd(ge.current);switch(o){case 1:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case 2:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;default:switch(a){case`svg`:o=s.createElementNS(`http://www.w3.org/2000/svg`,a);break;case`math`:o=s.createElementNS(`http://www.w3.org/1998/Math/MathML`,a);break;case`script`:o=s.createElement(`div`),o.innerHTML=`<script><\/script>`,o=o.removeChild(o.firstChild);break;case`select`:o=typeof r.is==`string`?s.createElement(`select`,{is:r.is}):s.createElement(`select`),r.multiple?o.multiple=!0:r.size&&(o.size=r.size);break;default:o=typeof r.is==`string`?s.createElement(a,{is:r.is}):s.createElement(a)}}o[ht]=t,o[gt]=r;a:for(s=t.child;s!==null;){if(s.tag===5||s.tag===6)o.appendChild(s.stateNode);else if(s.tag!==4&&s.tag!==27&&s.child!==null){s.child.return=s,s=s.child;continue}if(s===t)break a;for(;s.sibling===null;){if(s.return===null||s.return===t)break a;s=s.return}s.sibling.return=s.return,s=s.sibling}t.stateNode=o;a:switch(Pd(o,a,r),a){case`button`:case`input`:case`select`:case`textarea`:r=!!r.autoFocus;break a;case`img`:r=!0;break a;default:r=!1}r&&Ic(t)}}return V(t),Lc(t,t.type,e===null?null:e.memoizedProps,t.pendingProps,n),null;case 6:if(e&&t.stateNode!=null)e.memoizedProps!==r&&Ic(t);else{if(typeof r!=`string`&&t.stateNode===null)throw Error(i(166));if(e=ge.current,Ji(t)){if(e=t.stateNode,n=t.memoizedProps,r=null,a=Vi,a!==null)switch(a.tag){case 27:case 5:r=a.memoizedProps}e[ht]=t,e=!!(e.nodeValue===n||r!==null&&!0===r.suppressHydrationWarning||Md(e.nodeValue,n)),e||Gi(t,!0)}else e=Bd(e).createTextNode(r),e[ht]=t,t.stateNode=e}return V(t),null;case 31:if(n=t.memoizedState,e===null||e.memoizedState!==null){if(r=Ji(t),n!==null){if(e===null){if(!r)throw Error(i(318));if(e=t.memoizedState,e=e===null?null:e.dehydrated,!e)throw Error(i(557));e[ht]=t}else Yi(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;V(t),e=!1}else n=Xi(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=n),e=!0;if(!e)return t.flags&256?(go(t),t):(go(t),null);if(t.flags&128)throw Error(i(558))}return V(t),null;case 13:if(r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(a=Ji(t),r!==null&&r.dehydrated!==null){if(e===null){if(!a)throw Error(i(318));if(a=t.memoizedState,a=a===null?null:a.dehydrated,!a)throw Error(i(317));a[ht]=t}else Yi(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;V(t),a=!1}else a=Xi(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),a=!0;if(!a)return t.flags&256?(go(t),t):(go(t),null)}return go(t),t.flags&128?(t.lanes=n,t):(n=r!==null,e=e!==null&&e.memoizedState!==null,n&&(r=t.child,a=null,r.alternate!==null&&r.alternate.memoizedState!==null&&r.alternate.memoizedState.cachePool!==null&&(a=r.alternate.memoizedState.cachePool.pool),o=null,r.memoizedState!==null&&r.memoizedState.cachePool!==null&&(o=r.memoizedState.cachePool.pool),o!==a&&(r.flags|=2048)),n!==e&&n&&(t.child.flags|=8192),zc(t,t.updateQueue),V(t),null);case 4:return ye(),e===null&&Sd(t.stateNode.containerInfo),V(t),null;case 10:return na(t.type),V(t),null;case 19:if(O(P),r=t.memoizedState,r===null)return V(t),null;if(a=(t.flags&128)!=0,o=r.rendering,o===null)if(a)Bc(r,!1);else{if(Y!==0||e!==null&&e.flags&128)for(e=t.child;e!==null;){if(o=_o(e),o!==null){for(t.flags|=128,Bc(r,!1),e=o.updateQueue,t.updateQueue=e,zc(t,e),t.subtreeFlags=0,e=n,n=t.child;n!==null;)yi(n,e),n=n.sibling;return k(P,P.current&1|2),M&&Ii(t,r.treeForkCount),t.child}e=e.sibling}r.tail!==null&&Pe()>nu&&(t.flags|=128,a=!0,Bc(r,!1),t.lanes=4194304)}else{if(!a)if(e=_o(o),e!==null){if(t.flags|=128,a=!0,e=e.updateQueue,t.updateQueue=e,zc(t,e),Bc(r,!0),r.tail===null&&r.tailMode===`hidden`&&!o.alternate&&!M)return V(t),null}else 2*Pe()-r.renderingStartTime>nu&&n!==536870912&&(t.flags|=128,a=!0,Bc(r,!1),t.lanes=4194304);r.isBackwards?(o.sibling=t.child,t.child=o):(e=r.last,e===null?t.child=o:e.sibling=o,r.last=o)}return r.tail===null?(V(t),null):(e=r.tail,r.rendering=e,r.tail=e.sibling,r.renderingStartTime=Pe(),e.sibling=null,n=P.current,k(P,a?n&1|2:n&1),M&&Ii(t,r.treeForkCount),e);case 22:case 23:return go(t),co(),r=t.memoizedState!==null,e===null?r&&(t.flags|=8192):e.memoizedState!==null!==r&&(t.flags|=8192),r?n&536870912&&!(t.flags&128)&&(V(t),t.subtreeFlags&6&&(t.flags|=8192)):V(t),n=t.updateQueue,n!==null&&zc(t,n.retryQueue),n=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),r=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(r=t.memoizedState.cachePool.pool),r!==n&&(t.flags|=2048),e!==null&&O(wa),null;case 24:return n=null,e!==null&&(n=e.memoizedState.cache),t.memoizedState.cache!==n&&(t.flags|=2048),na(N),V(t),null;case 25:return null;case 30:return null}throw Error(i(156,t.tag))}function Hc(e,t){switch(zi(t),t.tag){case 1:return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return na(N),ye(),e=t.flags,e&65536&&!(e&128)?(t.flags=e&-65537|128,t):null;case 26:case 27:case 5:return xe(t),null;case 31:if(t.memoizedState!==null){if(go(t),t.alternate===null)throw Error(i(340));Yi()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 13:if(go(t),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(i(340));Yi()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return O(P),null;case 4:return ye(),null;case 10:return na(t.type),null;case 22:case 23:return go(t),co(),e!==null&&O(wa),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 24:return na(N),null;case 25:return null;default:return null}}function Uc(e,t){switch(zi(t),t.tag){case 3:na(N),ye();break;case 26:case 27:case 5:xe(t);break;case 4:ye();break;case 31:t.memoizedState!==null&&go(t);break;case 13:go(t);break;case 19:O(P);break;case 10:na(t.type);break;case 22:case 23:go(t),co(),e!==null&&O(wa);break;case 24:na(N)}}function Wc(e,t){try{var n=t.updateQueue,r=n===null?null:n.lastEffect;if(r!==null){var i=r.next;n=i;do{if((n.tag&e)===e){r=void 0;var a=n.create,o=n.inst;r=a(),o.destroy=r}n=n.next}while(n!==i)}}catch(e){Z(t,t.return,e)}}function Gc(e,t,n){try{var r=t.updateQueue,i=r===null?null:r.lastEffect;if(i!==null){var a=i.next;r=a;do{if((r.tag&e)===e){var o=r.inst,s=o.destroy;if(s!==void 0){o.destroy=void 0,i=t;var c=n,l=s;try{l()}catch(e){Z(i,c,e)}}}r=r.next}while(r!==a)}}catch(e){Z(t,t.return,e)}}function Kc(e){var t=e.updateQueue;if(t!==null){var n=e.stateNode;try{ro(t,n)}catch(t){Z(e,e.return,t)}}}function qc(e,t,n){n.props=Xs(e.type,e.memoizedProps),n.state=e.memoizedState;try{n.componentWillUnmount()}catch(n){Z(e,t,n)}}function Jc(e,t){try{var n=e.ref;if(n!==null){switch(e.tag){case 26:case 27:case 5:var r=e.stateNode;break;case 30:r=e.stateNode;break;default:r=e.stateNode}typeof n==`function`?e.refCleanup=n(r):n.current=r}}catch(n){Z(e,t,n)}}function Yc(e,t){var n=e.ref,r=e.refCleanup;if(n!==null)if(typeof r==`function`)try{r()}catch(n){Z(e,t,n)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof n==`function`)try{n(null)}catch(n){Z(e,t,n)}else n.current=null}function Xc(e){var t=e.type,n=e.memoizedProps,r=e.stateNode;try{a:switch(t){case`button`:case`input`:case`select`:case`textarea`:n.autoFocus&&r.focus();break a;case`img`:n.src?r.src=n.src:n.srcSet&&(r.srcset=n.srcSet)}}catch(t){Z(e,e.return,t)}}function Zc(e,t,n){try{var r=e.stateNode;Fd(r,e.type,n,t),r[gt]=t}catch(t){Z(e,e.return,t)}}function Qc(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&Zd(e.type)||e.tag===4}function $c(e){a:for(;;){for(;e.sibling===null;){if(e.return===null||Qc(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&Zd(e.type)||e.flags&2||e.child===null||e.tag===4)continue a;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function el(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?(n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n).insertBefore(e,t):(t=n.nodeType===9?n.body:n.nodeName===`HTML`?n.ownerDocument.body:n,t.appendChild(e),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=cn));else if(r!==4&&(r===27&&Zd(e.type)&&(n=e.stateNode,t=null),e=e.child,e!==null))for(el(e,t,n),e=e.sibling;e!==null;)el(e,t,n),e=e.sibling}function tl(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(r!==4&&(r===27&&Zd(e.type)&&(n=e.stateNode),e=e.child,e!==null))for(tl(e,t,n),e=e.sibling;e!==null;)tl(e,t,n),e=e.sibling}function nl(e){var t=e.stateNode,n=e.memoizedProps;try{for(var r=e.type,i=t.attributes;i.length;)t.removeAttributeNode(i[0]);Pd(t,r,n),t[ht]=e,t[gt]=n}catch(t){Z(e,e.return,t)}}var rl=!1,H=!1,il=!1,al=typeof WeakSet==`function`?WeakSet:Set,ol=null;function sl(e,t){if(e=e.containerInfo,Rd=sp,e=Fr(e),Ir(e)){if(`selectionStart`in e)var n={start:e.selectionStart,end:e.selectionEnd};else a:{n=(n=e.ownerDocument)&&n.defaultView||window;var r=n.getSelection&&n.getSelection();if(r&&r.rangeCount!==0){n=r.anchorNode;var a=r.anchorOffset,o=r.focusNode;r=r.focusOffset;try{n.nodeType,o.nodeType}catch{n=null;break a}var s=0,c=-1,l=-1,u=0,d=0,f=e,p=null;b:for(;;){for(var m;f!==n||a!==0&&f.nodeType!==3||(c=s+a),f!==o||r!==0&&f.nodeType!==3||(l=s+r),f.nodeType===3&&(s+=f.nodeValue.length),(m=f.firstChild)!==null;)p=f,f=m;for(;;){if(f===e)break b;if(p===n&&++u===a&&(c=s),p===o&&++d===r&&(l=s),(m=f.nextSibling)!==null)break;f=p,p=f.parentNode}f=m}n=c===-1||l===-1?null:{start:c,end:l}}else n=null}n||={start:0,end:0}}else n=null;for(zd={focusedElem:e,selectionRange:n},sp=!1,ol=t;ol!==null;)if(t=ol,e=t.child,t.subtreeFlags&1028&&e!==null)e.return=t,ol=e;else for(;ol!==null;){switch(t=ol,o=t.alternate,e=t.flags,t.tag){case 0:if(e&4&&(e=t.updateQueue,e=e===null?null:e.events,e!==null))for(n=0;n<e.length;n++)a=e[n],a.ref.impl=a.nextImpl;break;case 11:case 15:break;case 1:if(e&1024&&o!==null){e=void 0,n=t,a=o.memoizedProps,o=o.memoizedState,r=n.stateNode;try{var h=Xs(n.type,a);e=r.getSnapshotBeforeUpdate(h,o),r.__reactInternalSnapshotBeforeUpdate=e}catch(e){Z(n,n.return,e)}}break;case 3:if(e&1024){if(e=t.stateNode.containerInfo,n=e.nodeType,n===9)ef(e);else if(n===1)switch(e.nodeName){case`HEAD`:case`HTML`:case`BODY`:ef(e);break;default:e.textContent=``}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if(e&1024)throw Error(i(163))}if(e=t.sibling,e!==null){e.return=t.return,ol=e;break}ol=t.return}}function cl(e,t,n){var r=n.flags;switch(n.tag){case 0:case 11:case 15:Sl(e,n),r&4&&Wc(5,n);break;case 1:if(Sl(e,n),r&4)if(e=n.stateNode,t===null)try{e.componentDidMount()}catch(e){Z(n,n.return,e)}else{var i=Xs(n.type,t.memoizedProps);t=t.memoizedState;try{e.componentDidUpdate(i,t,e.__reactInternalSnapshotBeforeUpdate)}catch(e){Z(n,n.return,e)}}r&64&&Kc(n),r&512&&Jc(n,n.return);break;case 3:if(Sl(e,n),r&64&&(e=n.updateQueue,e!==null)){if(t=null,n.child!==null)switch(n.child.tag){case 27:case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}try{ro(e,t)}catch(e){Z(n,n.return,e)}}break;case 27:t===null&&r&4&&nl(n);case 26:case 5:Sl(e,n),t===null&&r&4&&Xc(n),r&512&&Jc(n,n.return);break;case 12:Sl(e,n);break;case 31:Sl(e,n),r&4&&pl(e,n);break;case 13:Sl(e,n),r&4&&ml(e,n),r&64&&(e=n.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(n=Ju.bind(null,n),sf(e,n))));break;case 22:if(r=n.memoizedState!==null||rl,!r){t=t!==null&&t.memoizedState!==null||H,i=rl;var a=H;rl=r,(H=t)&&!a?wl(e,n,(n.subtreeFlags&8772)!=0):Sl(e,n),rl=i,H=a}break;case 30:break;default:Sl(e,n)}}function ll(e){var t=e.alternate;t!==null&&(e.alternate=null,ll(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&Ct(t)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var U=null,ul=!1;function dl(e,t,n){for(n=n.child;n!==null;)fl(e,t,n),n=n.sibling}function fl(e,t,n){if(We&&typeof We.onCommitFiberUnmount==`function`)try{We.onCommitFiberUnmount(Ue,n)}catch{}switch(n.tag){case 26:H||Yc(n,t),dl(e,t,n),n.memoizedState?n.memoizedState.count--:n.stateNode&&(n=n.stateNode,n.parentNode.removeChild(n));break;case 27:H||Yc(n,t);var r=U,i=ul;Zd(n.type)&&(U=n.stateNode,ul=!1),dl(e,t,n),pf(n.stateNode),U=r,ul=i;break;case 5:H||Yc(n,t);case 6:if(r=U,i=ul,U=null,dl(e,t,n),U=r,ul=i,U!==null)if(ul)try{(U.nodeType===9?U.body:U.nodeName===`HTML`?U.ownerDocument.body:U).removeChild(n.stateNode)}catch(e){Z(n,t,e)}else try{U.removeChild(n.stateNode)}catch(e){Z(n,t,e)}break;case 18:U!==null&&(ul?(e=U,Qd(e.nodeType===9?e.body:e.nodeName===`HTML`?e.ownerDocument.body:e,n.stateNode),Np(e)):Qd(U,n.stateNode));break;case 4:r=U,i=ul,U=n.stateNode.containerInfo,ul=!0,dl(e,t,n),U=r,ul=i;break;case 0:case 11:case 14:case 15:Gc(2,n,t),H||Gc(4,n,t),dl(e,t,n);break;case 1:H||(Yc(n,t),r=n.stateNode,typeof r.componentWillUnmount==`function`&&qc(n,t,r)),dl(e,t,n);break;case 21:dl(e,t,n);break;case 22:H=(r=H)||n.memoizedState!==null,dl(e,t,n),H=r;break;default:dl(e,t,n)}}function pl(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Np(e)}catch(e){Z(t,t.return,e)}}}function ml(e,t){if(t.memoizedState===null&&(e=t.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Np(e)}catch(e){Z(t,t.return,e)}}function hl(e){switch(e.tag){case 31:case 13:case 19:var t=e.stateNode;return t===null&&(t=e.stateNode=new al),t;case 22:return e=e.stateNode,t=e._retryCache,t===null&&(t=e._retryCache=new al),t;default:throw Error(i(435,e.tag))}}function gl(e,t){var n=hl(e);t.forEach(function(t){if(!n.has(t)){n.add(t);var r=Yu.bind(null,e,t);t.then(r,r)}})}function _l(e,t){var n=t.deletions;if(n!==null)for(var r=0;r<n.length;r++){var a=n[r],o=e,s=t,c=s;a:for(;c!==null;){switch(c.tag){case 27:if(Zd(c.type)){U=c.stateNode,ul=!1;break a}break;case 5:U=c.stateNode,ul=!1;break a;case 3:case 4:U=c.stateNode.containerInfo,ul=!0;break a}c=c.return}if(U===null)throw Error(i(160));fl(o,s,a),U=null,ul=!1,o=a.alternate,o!==null&&(o.return=null),a.return=null}if(t.subtreeFlags&13886)for(t=t.child;t!==null;)yl(t,e),t=t.sibling}var vl=null;function yl(e,t){var n=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:_l(t,e),bl(e),r&4&&(Gc(3,e,e.return),Wc(3,e),Gc(5,e,e.return));break;case 1:_l(t,e),bl(e),r&512&&(H||n===null||Yc(n,n.return)),r&64&&rl&&(e=e.updateQueue,e!==null&&(r=e.callbacks,r!==null&&(n=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=n===null?r:n.concat(r))));break;case 26:var a=vl;if(_l(t,e),bl(e),r&512&&(H||n===null||Yc(n,n.return)),r&4){var o=n===null?null:n.memoizedState;if(r=e.memoizedState,n===null)if(r===null)if(e.stateNode===null){a:{r=e.type,n=e.memoizedProps,a=a.ownerDocument||a;b:switch(r){case`title`:o=a.getElementsByTagName(`title`)[0],(!o||o[St]||o[ht]||o.namespaceURI===`http://www.w3.org/2000/svg`||o.hasAttribute(`itemprop`))&&(o=a.createElement(r),a.head.insertBefore(o,a.querySelector(`head > title`))),Pd(o,r,n),o[ht]=e,A(o),r=o;break a;case`link`:var s=Vf(`link`,`href`,a).get(r+(n.href||``));if(s){for(var c=0;c<s.length;c++)if(o=s[c],o.getAttribute(`href`)===(n.href==null||n.href===``?null:n.href)&&o.getAttribute(`rel`)===(n.rel==null?null:n.rel)&&o.getAttribute(`title`)===(n.title==null?null:n.title)&&o.getAttribute(`crossorigin`)===(n.crossOrigin==null?null:n.crossOrigin)){s.splice(c,1);break b}}o=a.createElement(r),Pd(o,r,n),a.head.appendChild(o);break;case`meta`:if(s=Vf(`meta`,`content`,a).get(r+(n.content||``))){for(c=0;c<s.length;c++)if(o=s[c],o.getAttribute(`content`)===(n.content==null?null:``+n.content)&&o.getAttribute(`name`)===(n.name==null?null:n.name)&&o.getAttribute(`property`)===(n.property==null?null:n.property)&&o.getAttribute(`http-equiv`)===(n.httpEquiv==null?null:n.httpEquiv)&&o.getAttribute(`charset`)===(n.charSet==null?null:n.charSet)){s.splice(c,1);break b}}o=a.createElement(r),Pd(o,r,n),a.head.appendChild(o);break;default:throw Error(i(468,r))}o[ht]=e,A(o),r=o}e.stateNode=r}else Hf(a,e.type,e.stateNode);else e.stateNode=If(a,r,e.memoizedProps);else o===r?r===null&&e.stateNode!==null&&Zc(e,e.memoizedProps,n.memoizedProps):(o===null?n.stateNode!==null&&(n=n.stateNode,n.parentNode.removeChild(n)):o.count--,r===null?Hf(a,e.type,e.stateNode):If(a,r,e.memoizedProps))}break;case 27:_l(t,e),bl(e),r&512&&(H||n===null||Yc(n,n.return)),n!==null&&r&4&&Zc(e,e.memoizedProps,n.memoizedProps);break;case 5:if(_l(t,e),bl(e),r&512&&(H||n===null||Yc(n,n.return)),e.flags&32){a=e.stateNode;try{$t(a,``)}catch(t){Z(e,e.return,t)}}r&4&&e.stateNode!=null&&(a=e.memoizedProps,Zc(e,a,n===null?a:n.memoizedProps)),r&1024&&(il=!0);break;case 6:if(_l(t,e),bl(e),r&4){if(e.stateNode===null)throw Error(i(162));r=e.memoizedProps,n=e.stateNode;try{n.nodeValue=r}catch(t){Z(e,e.return,t)}}break;case 3:if(Bf=null,a=vl,vl=gf(t.containerInfo),_l(t,e),vl=a,bl(e),r&4&&n!==null&&n.memoizedState.isDehydrated)try{Np(t.containerInfo)}catch(t){Z(e,e.return,t)}il&&(il=!1,xl(e));break;case 4:r=vl,vl=gf(e.stateNode.containerInfo),_l(t,e),bl(e),vl=r;break;case 12:_l(t,e),bl(e);break;case 31:_l(t,e),bl(e),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,gl(e,r)));break;case 13:_l(t,e),bl(e),e.child.flags&8192&&e.memoizedState!==null!=(n!==null&&n.memoizedState!==null)&&(eu=Pe()),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,gl(e,r)));break;case 22:a=e.memoizedState!==null;var l=n!==null&&n.memoizedState!==null,u=rl,d=H;if(rl=u||a,H=d||l,_l(t,e),H=d,rl=u,bl(e),r&8192)a:for(t=e.stateNode,t._visibility=a?t._visibility&-2:t._visibility|1,a&&(n===null||l||rl||H||Cl(e)),n=null,t=e;;){if(t.tag===5||t.tag===26){if(n===null){l=n=t;try{if(o=l.stateNode,a)s=o.style,typeof s.setProperty==`function`?s.setProperty(`display`,`none`,`important`):s.display=`none`;else{c=l.stateNode;var f=l.memoizedProps.style,p=f!=null&&f.hasOwnProperty(`display`)?f.display:null;c.style.display=p==null||typeof p==`boolean`?``:(``+p).trim()}}catch(e){Z(l,l.return,e)}}}else if(t.tag===6){if(n===null){l=t;try{l.stateNode.nodeValue=a?``:l.memoizedProps}catch(e){Z(l,l.return,e)}}}else if(t.tag===18){if(n===null){l=t;try{var m=l.stateNode;a?$d(m,!0):$d(l.stateNode,!1)}catch(e){Z(l,l.return,e)}}}else if((t.tag!==22&&t.tag!==23||t.memoizedState===null||t===e)&&t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break a;for(;t.sibling===null;){if(t.return===null||t.return===e)break a;n===t&&(n=null),t=t.return}n===t&&(n=null),t.sibling.return=t.return,t=t.sibling}r&4&&(r=e.updateQueue,r!==null&&(n=r.retryQueue,n!==null&&(r.retryQueue=null,gl(e,n))));break;case 19:_l(t,e),bl(e),r&4&&(r=e.updateQueue,r!==null&&(e.updateQueue=null,gl(e,r)));break;case 30:break;case 21:break;default:_l(t,e),bl(e)}}function bl(e){var t=e.flags;if(t&2){try{for(var n,r=e.return;r!==null;){if(Qc(r)){n=r;break}r=r.return}if(n==null)throw Error(i(160));switch(n.tag){case 27:var a=n.stateNode;tl(e,$c(e),a);break;case 5:var o=n.stateNode;n.flags&32&&($t(o,``),n.flags&=-33),tl(e,$c(e),o);break;case 3:case 4:var s=n.stateNode.containerInfo;el(e,$c(e),s);break;default:throw Error(i(161))}}catch(t){Z(e,e.return,t)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function xl(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var t=e;xl(t),t.tag===5&&t.flags&1024&&t.stateNode.reset(),e=e.sibling}}function Sl(e,t){if(t.subtreeFlags&8772)for(t=t.child;t!==null;)cl(e,t.alternate,t),t=t.sibling}function Cl(e){for(e=e.child;e!==null;){var t=e;switch(t.tag){case 0:case 11:case 14:case 15:Gc(4,t,t.return),Cl(t);break;case 1:Yc(t,t.return);var n=t.stateNode;typeof n.componentWillUnmount==`function`&&qc(t,t.return,n),Cl(t);break;case 27:pf(t.stateNode);case 26:case 5:Yc(t,t.return),Cl(t);break;case 22:t.memoizedState===null&&Cl(t);break;case 30:Cl(t);break;default:Cl(t)}e=e.sibling}}function wl(e,t,n){for(n&&=(t.subtreeFlags&8772)!=0,t=t.child;t!==null;){var r=t.alternate,i=e,a=t,o=a.flags;switch(a.tag){case 0:case 11:case 15:wl(i,a,n),Wc(4,a);break;case 1:if(wl(i,a,n),r=a,i=r.stateNode,typeof i.componentDidMount==`function`)try{i.componentDidMount()}catch(e){Z(r,r.return,e)}if(r=a,i=r.updateQueue,i!==null){var s=r.stateNode;try{var c=i.shared.hiddenCallbacks;if(c!==null)for(i.shared.hiddenCallbacks=null,i=0;i<c.length;i++)no(c[i],s)}catch(e){Z(r,r.return,e)}}n&&o&64&&Kc(a),Jc(a,a.return);break;case 27:nl(a);case 26:case 5:wl(i,a,n),n&&r===null&&o&4&&Xc(a),Jc(a,a.return);break;case 12:wl(i,a,n);break;case 31:wl(i,a,n),n&&o&4&&pl(i,a);break;case 13:wl(i,a,n),n&&o&4&&ml(i,a);break;case 22:a.memoizedState===null&&wl(i,a,n),Jc(a,a.return);break;case 30:break;default:wl(i,a,n)}t=t.sibling}}function Tl(e,t){var n=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(n=e.memoizedState.cachePool.pool),e=null,t.memoizedState!==null&&t.memoizedState.cachePool!==null&&(e=t.memoizedState.cachePool.pool),e!==n&&(e!=null&&e.refCount++,n!=null&&ha(n))}function El(e,t){e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&ha(e))}function Dl(e,t,n,r){if(t.subtreeFlags&10256)for(t=t.child;t!==null;)Ol(e,t,n,r),t=t.sibling}function Ol(e,t,n,r){var i=t.flags;switch(t.tag){case 0:case 11:case 15:Dl(e,t,n,r),i&2048&&Wc(9,t);break;case 1:Dl(e,t,n,r);break;case 3:Dl(e,t,n,r),i&2048&&(e=null,t.alternate!==null&&(e=t.alternate.memoizedState.cache),t=t.memoizedState.cache,t!==e&&(t.refCount++,e!=null&&ha(e)));break;case 12:if(i&2048){Dl(e,t,n,r),e=t.stateNode;try{var a=t.memoizedProps,o=a.id,s=a.onPostCommit;typeof s==`function`&&s(o,t.alternate===null?`mount`:`update`,e.passiveEffectDuration,-0)}catch(e){Z(t,t.return,e)}}else Dl(e,t,n,r);break;case 31:Dl(e,t,n,r);break;case 13:Dl(e,t,n,r);break;case 23:break;case 22:a=t.stateNode,o=t.alternate,t.memoizedState===null?a._visibility&2?Dl(e,t,n,r):(a._visibility|=2,kl(e,t,n,r,(t.subtreeFlags&10256)!=0||!1)):a._visibility&2?Dl(e,t,n,r):Al(e,t),i&2048&&Tl(o,t);break;case 24:Dl(e,t,n,r),i&2048&&El(t.alternate,t);break;default:Dl(e,t,n,r)}}function kl(e,t,n,r,i){for(i&&=(t.subtreeFlags&10256)!=0||!1,t=t.child;t!==null;){var a=e,o=t,s=n,c=r,l=o.flags;switch(o.tag){case 0:case 11:case 15:kl(a,o,s,c,i),Wc(8,o);break;case 23:break;case 22:var u=o.stateNode;o.memoizedState===null?(u._visibility|=2,kl(a,o,s,c,i)):u._visibility&2?kl(a,o,s,c,i):Al(a,o),i&&l&2048&&Tl(o.alternate,o);break;case 24:kl(a,o,s,c,i),i&&l&2048&&El(o.alternate,o);break;default:kl(a,o,s,c,i)}t=t.sibling}}function Al(e,t){if(t.subtreeFlags&10256)for(t=t.child;t!==null;){var n=e,r=t,i=r.flags;switch(r.tag){case 22:Al(n,r),i&2048&&Tl(r.alternate,r);break;case 24:Al(n,r),i&2048&&El(r.alternate,r);break;default:Al(n,r)}t=t.sibling}}var jl=8192;function Ml(e,t,n){if(e.subtreeFlags&jl)for(e=e.child;e!==null;)Nl(e,t,n),e=e.sibling}function Nl(e,t,n){switch(e.tag){case 26:Ml(e,t,n),e.flags&jl&&e.memoizedState!==null&&Gf(n,vl,e.memoizedState,e.memoizedProps);break;case 5:Ml(e,t,n);break;case 3:case 4:var r=vl;vl=gf(e.stateNode.containerInfo),Ml(e,t,n),vl=r;break;case 22:e.memoizedState===null&&(r=e.alternate,r!==null&&r.memoizedState!==null?(r=jl,jl=16777216,Ml(e,t,n),jl=r):Ml(e,t,n));break;default:Ml(e,t,n)}}function Pl(e){var t=e.alternate;if(t!==null&&(e=t.child,e!==null)){t.child=null;do t=e.sibling,e.sibling=null,e=t;while(e!==null)}}function Fl(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];ol=r,Rl(r,e)}Pl(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)Il(e),e=e.sibling}function Il(e){switch(e.tag){case 0:case 11:case 15:Fl(e),e.flags&2048&&Gc(9,e,e.return);break;case 3:Fl(e);break;case 12:Fl(e);break;case 22:var t=e.stateNode;e.memoizedState!==null&&t._visibility&2&&(e.return===null||e.return.tag!==13)?(t._visibility&=-3,Ll(e)):Fl(e);break;default:Fl(e)}}function Ll(e){var t=e.deletions;if(e.flags&16){if(t!==null)for(var n=0;n<t.length;n++){var r=t[n];ol=r,Rl(r,e)}Pl(e)}for(e=e.child;e!==null;){switch(t=e,t.tag){case 0:case 11:case 15:Gc(8,t,t.return),Ll(t);break;case 22:n=t.stateNode,n._visibility&2&&(n._visibility&=-3,Ll(t));break;default:Ll(t)}e=e.sibling}}function Rl(e,t){for(;ol!==null;){var n=ol;switch(n.tag){case 0:case 11:case 15:Gc(8,n,t);break;case 23:case 22:if(n.memoizedState!==null&&n.memoizedState.cachePool!==null){var r=n.memoizedState.cachePool.pool;r!=null&&r.refCount++}break;case 24:ha(n.memoizedState.cache)}if(r=n.child,r!==null)r.return=n,ol=r;else a:for(n=e;ol!==null;){r=ol;var i=r.sibling,a=r.return;if(ll(r),r===n){ol=null;break a}if(i!==null){i.return=a,ol=i;break a}ol=a}}}var zl={getCacheForType:function(e){var t=ca(N),n=t.data.get(e);return n===void 0&&(n=e(),t.data.set(e,n)),n},cacheSignal:function(){return ca(N).controller.signal}},Bl=typeof WeakMap==`function`?WeakMap:Map,W=0,G=null,K=null,q=0,J=0,Vl=null,Hl=!1,Ul=!1,Wl=!1,Gl=0,Y=0,Kl=0,ql=0,Jl=0,Yl=0,Xl=0,Zl=null,Ql=null,$l=!1,eu=0,tu=0,nu=1/0,ru=null,iu=null,X=0,au=null,ou=null,su=0,cu=0,lu=null,uu=null,du=0,fu=null;function pu(){return W&2&&q!==0?q&-q:T.T===null?ft():dd()}function mu(){if(Yl===0)if(!(q&536870912)||M){var e=Ze;Ze<<=1,!(Ze&3932160)&&(Ze=262144),Yl=e}else Yl=536870912;return e=lo.current,e!==null&&(e.flags|=32),Yl}function hu(e,t,n){(e===G&&(J===2||J===9)||e.cancelPendingCommit!==null)&&(Su(e,0),yu(e,q,Yl,!1)),at(e,n),(!(W&2)||e!==G)&&(e===G&&(!(W&2)&&(ql|=n),Y===4&&yu(e,q,Yl,!1)),rd(e))}function gu(e,t,n){if(W&6)throw Error(i(327));var r=!n&&(t&127)==0&&(t&e.expiredLanes)===0||tt(e,t),a=r?Au(e,t):Ou(e,t,!0),o=r;do{if(a===0){Ul&&!r&&yu(e,t,0,!1);break}else{if(n=e.current.alternate,o&&!vu(n)){a=Ou(e,t,!1),o=!1;continue}if(a===2){if(o=t,e.errorRecoveryDisabledLanes&o)var s=0;else s=e.pendingLanes&-536870913,s=s===0?s&536870912?536870912:0:s;if(s!==0){t=s;a:{var c=e;a=Zl;var l=c.current.memoizedState.isDehydrated;if(l&&(Su(c,s).flags|=256),s=Ou(c,s,!1),s!==2){if(Wl&&!l){c.errorRecoveryDisabledLanes|=o,ql|=o,a=4;break a}o=Ql,Ql=a,o!==null&&(Ql===null?Ql=o:Ql.push.apply(Ql,o))}a=s}if(o=!1,a!==2)continue}}if(a===1){Su(e,0),yu(e,t,0,!0);break}a:{switch(r=e,o=a,o){case 0:case 1:throw Error(i(345));case 4:if((t&4194048)!==t)break;case 6:yu(r,t,Yl,!Hl);break a;case 2:Ql=null;break;case 3:case 5:break;default:throw Error(i(329))}if((t&62914560)===t&&(a=eu+300-Pe(),10<a)){if(yu(r,t,Yl,!Hl),et(r,0,!0)!==0)break a;su=t,r.timeoutHandle=Kd(_u.bind(null,r,n,Ql,ru,$l,t,Yl,ql,Xl,Hl,o,`Throttled`,-0,0),a);break a}_u(r,n,Ql,ru,$l,t,Yl,ql,Xl,Hl,o,null,-0,0)}}break}while(1);rd(e)}function _u(e,t,n,r,i,a,o,s,c,l,u,d,f,p){if(e.timeoutHandle=-1,d=t.subtreeFlags,d&8192||(d&16785408)==16785408){d={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:cn},Nl(t,a,d);var m=(a&62914560)===a?eu-Pe():(a&4194048)===a?tu-Pe():0;if(m=qf(d,m),m!==null){su=a,e.cancelPendingCommit=m(Lu.bind(null,e,t,a,n,r,i,o,s,c,u,d,null,f,p)),yu(e,a,o,!l);return}}Lu(e,t,a,n,r,i,o,s,c)}function vu(e){for(var t=e;;){var n=t.tag;if((n===0||n===11||n===15)&&t.flags&16384&&(n=t.updateQueue,n!==null&&(n=n.stores,n!==null)))for(var r=0;r<n.length;r++){var i=n[r],a=i.getSnapshot;i=i.value;try{if(!Ar(a(),i))return!1}catch{return!1}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function yu(e,t,n,r){t&=~Jl,t&=~ql,e.suspendedLanes|=t,e.pingedLanes&=~t,r&&(e.warmLanes|=t),r=e.expirationTimes;for(var i=t;0<i;){var a=31-Ke(i),o=1<<a;r[a]=-1,i&=~o}n!==0&&st(e,n,t)}function bu(){return W&6?!0:(id(0,!1),!1)}function xu(){if(K!==null){if(J===0)var e=K.return;else e=K,ea=$i=null,No(e),Ra=null,za=0,e=K;for(;e!==null;)Uc(e.alternate,e),e=e.return;K=null}}function Su(e,t){var n=e.timeoutHandle;n!==-1&&(e.timeoutHandle=-1,qd(n)),n=e.cancelPendingCommit,n!==null&&(e.cancelPendingCommit=null,n()),su=0,xu(),G=e,K=n=vi(e.current,null),q=t,J=0,Vl=null,Hl=!1,Ul=tt(e,t),Wl=!1,Xl=Yl=Jl=ql=Kl=Y=0,Ql=Zl=null,$l=!1,t&8&&(t|=t&32);var r=e.entangledLanes;if(r!==0)for(e=e.entanglements,r&=t;0<r;){var i=31-Ke(r),a=1<<i;t|=e[i],r&=~a}return Gl=t,ci(),n}function Cu(e,t){F=null,T.H=Hs,t===Oa||t===Aa?(t=Ia(),J=3):t===ka?(t=Ia(),J=4):J=t===oc?8:typeof t==`object`&&t&&typeof t.then==`function`?6:1,Vl=t,K===null&&(Y=1,ec(e,Ei(t,e.current)))}function wu(){var e=lo.current;return e===null?!0:(q&4194048)===q?uo===null:(q&62914560)===q||q&536870912?e===uo:!1}function Tu(){var e=T.H;return T.H=Hs,e===null?Hs:e}function Eu(){var e=T.A;return T.A=zl,e}function Du(){Y=4,Hl||(q&4194048)!==q&&lo.current!==null||(Ul=!0),!(Kl&134217727)&&!(ql&134217727)||G===null||yu(G,q,Yl,!1)}function Ou(e,t,n){var r=W;W|=2;var i=Tu(),a=Eu();(G!==e||q!==t)&&(ru=null,Su(e,t)),t=!1;var o=Y;a:do try{if(J!==0&&K!==null){var s=K,c=Vl;switch(J){case 8:xu(),o=6;break a;case 3:case 2:case 9:case 6:lo.current===null&&(t=!0);var l=J;if(J=0,Vl=null,Pu(e,s,c,l),n&&Ul){o=0;break a}break;default:l=J,J=0,Vl=null,Pu(e,s,c,l)}}ku(),o=Y;break}catch(t){Cu(e,t)}while(1);return t&&e.shellSuspendCounter++,ea=$i=null,W=r,T.H=i,T.A=a,K===null&&(G=null,q=0,ci()),o}function ku(){for(;K!==null;)Mu(K)}function Au(e,t){var n=W;W|=2;var r=Tu(),a=Eu();G!==e||q!==t?(ru=null,nu=Pe()+500,Su(e,t)):Ul=tt(e,t);a:do try{if(J!==0&&K!==null){t=K;var o=Vl;b:switch(J){case 1:J=0,Vl=null,Pu(e,t,o,1);break;case 2:case 9:if(Ma(o)){J=0,Vl=null,Nu(t);break}t=function(){J!==2&&J!==9||G!==e||(J=7),rd(e)},o.then(t,t);break a;case 3:J=7;break a;case 4:J=5;break a;case 7:Ma(o)?(J=0,Vl=null,Nu(t)):(J=0,Vl=null,Pu(e,t,o,7));break;case 5:var s=null;switch(K.tag){case 26:s=K.memoizedState;case 5:case 27:var c=K;if(s?Wf(s):c.stateNode.complete){J=0,Vl=null;var l=c.sibling;if(l!==null)K=l;else{var u=c.return;u===null?K=null:(K=u,Fu(u))}break b}}J=0,Vl=null,Pu(e,t,o,5);break;case 6:J=0,Vl=null,Pu(e,t,o,6);break;case 8:xu(),Y=6;break a;default:throw Error(i(462))}}ju();break}catch(t){Cu(e,t)}while(1);return ea=$i=null,T.H=r,T.A=a,W=n,K===null?(G=null,q=0,ci(),Y):0}function ju(){for(;K!==null&&!Me();)Mu(K)}function Mu(e){var t=Fc(e.alternate,e,Gl);e.memoizedProps=e.pendingProps,t===null?Fu(e):K=t}function Nu(e){var t=e,n=t.alternate;switch(t.tag){case 15:case 0:t=yc(n,t,t.pendingProps,t.type,void 0,q);break;case 11:t=yc(n,t,t.pendingProps,t.type.render,t.ref,q);break;case 5:No(t);default:Uc(n,t),t=K=yi(t,Gl),t=Fc(n,t,Gl)}e.memoizedProps=e.pendingProps,t===null?Fu(e):K=t}function Pu(e,t,n,r){ea=$i=null,No(t),Ra=null,za=0;var i=t.return;try{if(ac(e,i,t,n,q)){Y=1,ec(e,Ei(n,e.current)),K=null;return}}catch(t){if(i!==null)throw K=i,t;Y=1,ec(e,Ei(n,e.current)),K=null;return}t.flags&32768?(M||r===1?e=!0:Ul||q&536870912?e=!1:(Hl=e=!0,(r===2||r===9||r===3||r===6)&&(r=lo.current,r!==null&&r.tag===13&&(r.flags|=16384))),Iu(t,e)):Fu(t)}function Fu(e){var t=e;do{if(t.flags&32768){Iu(t,Hl);return}e=t.return;var n=Vc(t.alternate,t,Gl);if(n!==null){K=n;return}if(t=t.sibling,t!==null){K=t;return}K=t=e}while(t!==null);Y===0&&(Y=5)}function Iu(e,t){do{var n=Hc(e.alternate,e);if(n!==null){n.flags&=32767,K=n;return}if(n=e.return,n!==null&&(n.flags|=32768,n.subtreeFlags=0,n.deletions=null),!t&&(e=e.sibling,e!==null)){K=e;return}K=e=n}while(e!==null);Y=6,K=null}function Lu(e,t,n,r,a,o,s,c,l){e.cancelPendingCommit=null;do Hu();while(X!==0);if(W&6)throw Error(i(327));if(t!==null){if(t===e.current)throw Error(i(177));if(o=t.lanes|t.childLanes,o|=si,ot(e,n,o,s,c,l),e===G&&(K=G=null,q=0),ou=t,au=e,su=n,cu=o,lu=a,uu=r,t.subtreeFlags&10256||t.flags&10256?(e.callbackNode=null,e.callbackPriority=0,Xu(Re,function(){return Uu(),null})):(e.callbackNode=null,e.callbackPriority=0),r=(t.flags&13878)!=0,t.subtreeFlags&13878||r){r=T.T,T.T=null,a=E.p,E.p=2,s=W,W|=4;try{sl(e,t,n)}finally{W=s,E.p=a,T.T=r}}X=1,Ru(),zu(),Bu()}}function Ru(){if(X===1){X=0;var e=au,t=ou,n=(t.flags&13878)!=0;if(t.subtreeFlags&13878||n){n=T.T,T.T=null;var r=E.p;E.p=2;var i=W;W|=4;try{yl(t,e);var a=zd,o=Fr(e.containerInfo),s=a.focusedElem,c=a.selectionRange;if(o!==s&&s&&s.ownerDocument&&Pr(s.ownerDocument.documentElement,s)){if(c!==null&&Ir(s)){var l=c.start,u=c.end;if(u===void 0&&(u=l),`selectionStart`in s)s.selectionStart=l,s.selectionEnd=Math.min(u,s.value.length);else{var d=s.ownerDocument||document,f=d&&d.defaultView||window;if(f.getSelection){var p=f.getSelection(),m=s.textContent.length,h=Math.min(c.start,m),g=c.end===void 0?h:Math.min(c.end,m);!p.extend&&h>g&&(o=g,g=h,h=o);var _=Nr(s,h),v=Nr(s,g);if(_&&v&&(p.rangeCount!==1||p.anchorNode!==_.node||p.anchorOffset!==_.offset||p.focusNode!==v.node||p.focusOffset!==v.offset)){var y=d.createRange();y.setStart(_.node,_.offset),p.removeAllRanges(),h>g?(p.addRange(y),p.extend(v.node,v.offset)):(y.setEnd(v.node,v.offset),p.addRange(y))}}}}for(d=[],p=s;p=p.parentNode;)p.nodeType===1&&d.push({element:p,left:p.scrollLeft,top:p.scrollTop});for(typeof s.focus==`function`&&s.focus(),s=0;s<d.length;s++){var b=d[s];b.element.scrollLeft=b.left,b.element.scrollTop=b.top}}sp=!!Rd,zd=Rd=null}finally{W=i,E.p=r,T.T=n}}e.current=t,X=2}}function zu(){if(X===2){X=0;var e=au,t=ou,n=(t.flags&8772)!=0;if(t.subtreeFlags&8772||n){n=T.T,T.T=null;var r=E.p;E.p=2;var i=W;W|=4;try{cl(e,t.alternate,t)}finally{W=i,E.p=r,T.T=n}}X=3}}function Bu(){if(X===4||X===3){X=0,Ne();var e=au,t=ou,n=su,r=uu;t.subtreeFlags&10256||t.flags&10256?X=5:(X=0,ou=au=null,Vu(e,e.pendingLanes));var i=e.pendingLanes;if(i===0&&(iu=null),dt(n),t=t.stateNode,We&&typeof We.onCommitFiberRoot==`function`)try{We.onCommitFiberRoot(Ue,t,void 0,(t.current.flags&128)==128)}catch{}if(r!==null){t=T.T,i=E.p,E.p=2,T.T=null;try{for(var a=e.onRecoverableError,o=0;o<r.length;o++){var s=r[o];a(s.value,{componentStack:s.stack})}}finally{T.T=t,E.p=i}}su&3&&Hu(),rd(e),i=e.pendingLanes,n&261930&&i&42?e===fu?du++:(du=0,fu=e):du=0,id(0,!1)}}function Vu(e,t){(e.pooledCacheLanes&=t)===0&&(t=e.pooledCache,t!=null&&(e.pooledCache=null,ha(t)))}function Hu(){return Ru(),zu(),Bu(),Uu()}function Uu(){if(X!==5)return!1;var e=au,t=cu;cu=0;var n=dt(su),r=T.T,a=E.p;try{E.p=32>n?32:n,T.T=null,n=lu,lu=null;var o=au,s=su;if(X=0,ou=au=null,su=0,W&6)throw Error(i(331));var c=W;if(W|=4,Il(o.current),Ol(o,o.current,s,n),W=c,id(0,!1),We&&typeof We.onPostCommitFiberRoot==`function`)try{We.onPostCommitFiberRoot(Ue,o)}catch{}return!0}finally{E.p=a,T.T=r,Vu(e,t)}}function Wu(e,t,n){t=Ei(n,t),t=nc(e.stateNode,t,2),e=Xa(e,t,2),e!==null&&(at(e,2),rd(e))}function Z(e,t,n){if(e.tag===3)Wu(e,e,n);else for(;t!==null;){if(t.tag===3){Wu(t,e,n);break}else if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError==`function`||typeof r.componentDidCatch==`function`&&(iu===null||!iu.has(r))){e=Ei(n,e),n=rc(2),r=Xa(t,n,2),r!==null&&(ic(n,r,t,e),at(r,2),rd(r));break}}t=t.return}}function Gu(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new Bl;var i=new Set;r.set(t,i)}else i=r.get(t),i===void 0&&(i=new Set,r.set(t,i));i.has(n)||(Wl=!0,i.add(n),e=Ku.bind(null,e,t,n),t.then(e,e))}function Ku(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),e.pingedLanes|=e.suspendedLanes&n,e.warmLanes&=~n,G===e&&(q&n)===n&&(Y===4||Y===3&&(q&62914560)===q&&300>Pe()-eu?!(W&2)&&Su(e,0):Jl|=n,Xl===q&&(Xl=0)),rd(e)}function qu(e,t){t===0&&(t=rt()),e=di(e,t),e!==null&&(at(e,t),rd(e))}function Ju(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),qu(e,n)}function Yu(e,t){var n=0;switch(e.tag){case 31:case 13:var r=e.stateNode,a=e.memoizedState;a!==null&&(n=a.retryLane);break;case 19:r=e.stateNode;break;case 22:r=e.stateNode._retryCache;break;default:throw Error(i(314))}r!==null&&r.delete(t),qu(e,n)}function Xu(e,t){return Ae(e,t)}var Zu=null,Qu=null,$u=!1,ed=!1,td=!1,nd=0;function rd(e){e!==Qu&&e.next===null&&(Qu===null?Zu=Qu=e:Qu=Qu.next=e),ed=!0,$u||($u=!0,ud())}function id(e,t){if(!td&&ed){td=!0;do for(var n=!1,r=Zu;r!==null;){if(!t)if(e!==0){var i=r.pendingLanes;if(i===0)var a=0;else{var o=r.suspendedLanes,s=r.pingedLanes;a=(1<<31-Ke(42|e)+1)-1,a&=i&~(o&~s),a=a&201326741?a&201326741|1:a?a|2:0}a!==0&&(n=!0,ld(r,a))}else a=q,a=et(r,r===G?a:0,r.cancelPendingCommit!==null||r.timeoutHandle!==-1),!(a&3)||tt(r,a)||(n=!0,ld(r,a));r=r.next}while(n);td=!1}}function ad(){od()}function od(){ed=$u=!1;var e=0;nd!==0&&Gd()&&(e=nd);for(var t=Pe(),n=null,r=Zu;r!==null;){var i=r.next,a=sd(r,t);a===0?(r.next=null,n===null?Zu=i:n.next=i,i===null&&(Qu=n)):(n=r,(e!==0||a&3)&&(ed=!0)),r=i}X!==0&&X!==5||id(e,!1),nd!==0&&(nd=0)}function sd(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,i=e.expirationTimes,a=e.pendingLanes&-62914561;0<a;){var o=31-Ke(a),s=1<<o,c=i[o];c===-1?((s&n)===0||(s&r)!==0)&&(i[o]=nt(s,t)):c<=t&&(e.expiredLanes|=s),a&=~s}if(t=G,n=q,n=et(e,e===t?n:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r=e.callbackNode,n===0||e===t&&(J===2||J===9)||e.cancelPendingCommit!==null)return r!==null&&r!==null&&je(r),e.callbackNode=null,e.callbackPriority=0;if(!(n&3)||tt(e,n)){if(t=n&-n,t===e.callbackPriority)return t;switch(r!==null&&je(r),dt(n)){case 2:case 8:n=Le;break;case 32:n=Re;break;case 268435456:n=Be;break;default:n=Re}return r=cd.bind(null,e),n=Ae(n,r),e.callbackPriority=t,e.callbackNode=n,t}return r!==null&&r!==null&&je(r),e.callbackPriority=2,e.callbackNode=null,2}function cd(e,t){if(X!==0&&X!==5)return e.callbackNode=null,e.callbackPriority=0,null;var n=e.callbackNode;if(Hu()&&e.callbackNode!==n)return null;var r=q;return r=et(e,e===G?r:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),r===0?null:(gu(e,r,t),sd(e,Pe()),e.callbackNode!=null&&e.callbackNode===n?cd.bind(null,e):null)}function ld(e,t){if(Hu())return null;gu(e,t,!0)}function ud(){Yd(function(){W&6?Ae(Ie,ad):od()})}function dd(){if(nd===0){var e=va;e===0&&(e=Xe,Xe<<=1,!(Xe&261888)&&(Xe=256)),nd=e}return nd}function fd(e){return e==null||typeof e==`symbol`||typeof e==`boolean`?null:typeof e==`function`?e:sn(``+e)}function pd(e,t){var n=t.ownerDocument.createElement(`input`);return n.name=t.name,n.value=t.value,e.id&&n.setAttribute(`form`,e.id),t.parentNode.insertBefore(n,t),e=new FormData(e),n.parentNode.removeChild(n),e}function md(e,t,n,r,i){if(t===`submit`&&n&&n.stateNode===i){var a=fd((i[gt]||null).action),o=r.submitter;o&&(t=(t=o[gt]||null)?fd(t.formAction):o.getAttribute(`formAction`),t!==null&&(a=t,o=null));var s=new kn(`action`,`action`,null,r,i);e.push({event:s,listeners:[{instance:null,listener:function(){if(r.defaultPrevented){if(nd!==0){var e=o?pd(i,o):new FormData(i);Os(n,{pending:!0,data:e,method:i.method,action:a},null,e)}}else typeof a==`function`&&(s.preventDefault(),e=o?pd(i,o):new FormData(i),Os(n,{pending:!0,data:e,method:i.method,action:a},a,e))},currentTarget:i}]})}}for(var hd=0;hd<ni.length;hd++){var gd=ni[hd];ri(gd.toLowerCase(),`on`+(gd[0].toUpperCase()+gd.slice(1)))}ri(Jr,`onAnimationEnd`),ri(Yr,`onAnimationIteration`),ri(Xr,`onAnimationStart`),ri(`dblclick`,`onDoubleClick`),ri(`focusin`,`onFocus`),ri(`focusout`,`onBlur`),ri(Zr,`onTransitionRun`),ri(Qr,`onTransitionStart`),ri($r,`onTransitionCancel`),ri(ei,`onTransitionEnd`),jt(`onMouseEnter`,[`mouseout`,`mouseover`]),jt(`onMouseLeave`,[`mouseout`,`mouseover`]),jt(`onPointerEnter`,[`pointerout`,`pointerover`]),jt(`onPointerLeave`,[`pointerout`,`pointerover`]),At(`onChange`,`change click focusin focusout input keydown keyup selectionchange`.split(` `)),At(`onSelect`,`focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange`.split(` `)),At(`onBeforeInput`,[`compositionend`,`keypress`,`textInput`,`paste`]),At(`onCompositionEnd`,`compositionend focusout keydown keypress keyup mousedown`.split(` `)),At(`onCompositionStart`,`compositionstart focusout keydown keypress keyup mousedown`.split(` `)),At(`onCompositionUpdate`,`compositionupdate focusout keydown keypress keyup mousedown`.split(` `));var _d=`abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting`.split(` `),vd=new Set(`beforetoggle cancel close invalid load scroll scrollend toggle`.split(` `).concat(_d));function yd(e,t){t=(t&4)!=0;for(var n=0;n<e.length;n++){var r=e[n],i=r.event;r=r.listeners;a:{var a=void 0;if(t)for(var o=r.length-1;0<=o;o--){var s=r[o],c=s.instance,l=s.currentTarget;if(s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){ii(e)}i.currentTarget=null,a=c}else for(o=0;o<r.length;o++){if(s=r[o],c=s.instance,l=s.currentTarget,s=s.listener,c!==a&&i.isPropagationStopped())break a;a=s,i.currentTarget=l;try{a(i)}catch(e){ii(e)}i.currentTarget=null,a=c}}}}function Q(e,t){var n=t[vt];n===void 0&&(n=t[vt]=new Set);var r=e+`__bubble`;n.has(r)||(Cd(t,e,2,!1),n.add(r))}function bd(e,t,n){var r=0;t&&(r|=4),Cd(n,e,r,t)}var xd=`_reactListening`+Math.random().toString(36).slice(2);function Sd(e){if(!e[xd]){e[xd]=!0,Ot.forEach(function(t){t!==`selectionchange`&&(vd.has(t)||bd(t,!1,e),bd(t,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[xd]||(t[xd]=!0,bd(`selectionchange`,!1,t))}}function Cd(e,t,n,r){switch(mp(t)){case 2:var i=cp;break;case 8:i=lp;break;default:i=up}n=i.bind(null,t,n,e),i=void 0,!vn||t!==`touchstart`&&t!==`touchmove`&&t!==`wheel`||(i=!0),r?i===void 0?e.addEventListener(t,n,!0):e.addEventListener(t,n,{capture:!0,passive:i}):i===void 0?e.addEventListener(t,n,!1):e.addEventListener(t,n,{passive:i})}function wd(e,t,n,r,i){var a=r;if(!(t&1)&&!(t&2)&&r!==null)a:for(;;){if(r===null)return;var o=r.tag;if(o===3||o===4){var s=r.stateNode.containerInfo;if(s===i)break;if(o===4)for(o=r.return;o!==null;){var l=o.tag;if((l===3||l===4)&&o.stateNode.containerInfo===i)return;o=o.return}for(;s!==null;){if(o=wt(s),o===null)return;if(l=o.tag,l===5||l===6||l===26||l===27){r=a=o;continue a}s=s.parentNode}}r=r.return}hn(function(){var r=a,i=un(n),o=[];a:{var s=ti.get(e);if(s!==void 0){var l=kn,u=e;switch(e){case`keypress`:if(wn(n)===0)break a;case`keydown`:case`keyup`:l=qn;break;case`focusin`:u=`focus`,l=Rn;break;case`focusout`:u=`blur`,l=Rn;break;case`beforeblur`:case`afterblur`:l=Rn;break;case`click`:if(n.button===2)break a;case`auxclick`:case`dblclick`:case`mousedown`:case`mousemove`:case`mouseup`:case`mouseout`:case`mouseover`:case`contextmenu`:l=In;break;case`drag`:case`dragend`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`dragstart`:case`drop`:l=Ln;break;case`touchcancel`:case`touchend`:case`touchmove`:case`touchstart`:l=Yn;break;case Jr:case Yr:case Xr:l=zn;break;case ei:l=Xn;break;case`scroll`:case`scrollend`:l=jn;break;case`wheel`:l=Zn;break;case`copy`:case`cut`:case`paste`:l=Bn;break;case`gotpointercapture`:case`lostpointercapture`:case`pointercancel`:case`pointerdown`:case`pointermove`:case`pointerout`:case`pointerover`:case`pointerup`:l=Jn;break;case`toggle`:case`beforetoggle`:l=Qn}var d=(t&4)!=0,f=!d&&(e===`scroll`||e===`scrollend`),p=d?s===null?null:s+`Capture`:s;d=[];for(var m=r,h;m!==null;){var g=m;if(h=g.stateNode,g=g.tag,g!==5&&g!==26&&g!==27||h===null||p===null||(g=gn(m,p),g!=null&&d.push(Td(m,g,h))),f)break;m=m.return}0<d.length&&(s=new l(s,u,null,n,i),o.push({event:s,listeners:d}))}}if(!(t&7)){a:{if(s=e===`mouseover`||e===`pointerover`,l=e===`mouseout`||e===`pointerout`,s&&n!==ln&&(u=n.relatedTarget||n.fromElement)&&(wt(u)||u[_t]))break a;if((l||s)&&(s=i.window===i?i:(s=i.ownerDocument)?s.defaultView||s.parentWindow:window,l?(u=n.relatedTarget||n.toElement,l=r,u=u?wt(u):null,u!==null&&(f=c(u),d=u.tag,u!==f||d!==5&&d!==27&&d!==6)&&(u=null)):(l=null,u=r),l!==u)){if(d=In,g=`onMouseLeave`,p=`onMouseEnter`,m=`mouse`,(e===`pointerout`||e===`pointerover`)&&(d=Jn,g=`onPointerLeave`,p=`onPointerEnter`,m=`pointer`),f=l==null?s:Et(l),h=u==null?s:Et(u),s=new d(g,m+`leave`,l,n,i),s.target=f,s.relatedTarget=h,g=null,wt(i)===r&&(d=new d(p,m+`enter`,u,n,i),d.target=h,d.relatedTarget=f,g=d),f=g,l&&u)b:{for(d=Dd,p=l,m=u,h=0,g=p;g;g=d(g))h++;g=0;for(var _=m;_;_=d(_))g++;for(;0<h-g;)p=d(p),h--;for(;0<g-h;)m=d(m),g--;for(;h--;){if(p===m||m!==null&&p===m.alternate){d=p;break b}p=d(p),m=d(m)}d=null}else d=null;l!==null&&Od(o,s,l,d,!1),u!==null&&f!==null&&Od(o,f,u,d,!0)}}a:{if(s=r?Et(r):window,l=s.nodeName&&s.nodeName.toLowerCase(),l===`select`||l===`input`&&s.type===`file`)var v=vr;else if(fr(s))if(yr)v=Or;else{v=Er;var y=Tr}else l=s.nodeName,!l||l.toLowerCase()!==`input`||s.type!==`checkbox`&&s.type!==`radio`?r&&rn(r.elementType)&&(v=vr):v=Dr;if(v&&=v(e,r)){pr(o,v,n,i);break a}y&&y(e,s,r),e===`focusout`&&r&&s.type===`number`&&r.memoizedProps.value!=null&&Yt(s,`number`,s.value)}switch(y=r?Et(r):window,e){case`focusin`:(fr(y)||y.contentEditable===`true`)&&(Rr=y,zr=r,Br=null);break;case`focusout`:Br=zr=Rr=null;break;case`mousedown`:Vr=!0;break;case`contextmenu`:case`mouseup`:case`dragend`:Vr=!1,Hr(o,n,i);break;case`selectionchange`:if(Lr)break;case`keydown`:case`keyup`:Hr(o,n,i)}var b;if(er)b:{switch(e){case`compositionstart`:var x=`onCompositionStart`;break b;case`compositionend`:x=`onCompositionEnd`;break b;case`compositionupdate`:x=`onCompositionUpdate`;break b}x=void 0}else cr?or(e,n)&&(x=`onCompositionEnd`):e===`keydown`&&n.keyCode===229&&(x=`onCompositionStart`);x&&(rr&&n.locale!==`ko`&&(cr||x!==`onCompositionStart`?x===`onCompositionEnd`&&cr&&(b=Cn()):(bn=i,xn=`value`in bn?bn.value:bn.textContent,cr=!0)),y=Ed(r,x),0<y.length&&(x=new Vn(x,e,null,n,i),o.push({event:x,listeners:y}),b?x.data=b:(b=sr(n),b!==null&&(x.data=b)))),(b=nr?lr(e,n):ur(e,n))&&(x=Ed(r,`onBeforeInput`),0<x.length&&(y=new Vn(`onBeforeInput`,`beforeinput`,null,n,i),o.push({event:y,listeners:x}),y.data=b)),md(o,e,r,n,i)}yd(o,t)})}function Td(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Ed(e,t){for(var n=t+`Capture`,r=[];e!==null;){var i=e,a=i.stateNode;if(i=i.tag,i!==5&&i!==26&&i!==27||a===null||(i=gn(e,n),i!=null&&r.unshift(Td(e,i,a)),i=gn(e,t),i!=null&&r.push(Td(e,i,a))),e.tag===3)return r;e=e.return}return[]}function Dd(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function Od(e,t,n,r,i){for(var a=t._reactName,o=[];n!==null&&n!==r;){var s=n,c=s.alternate,l=s.stateNode;if(s=s.tag,c!==null&&c===r)break;s!==5&&s!==26&&s!==27||l===null||(c=l,i?(l=gn(n,a),l!=null&&o.unshift(Td(n,l,c))):i||(l=gn(n,a),l!=null&&o.push(Td(n,l,c)))),n=n.return}o.length!==0&&e.push({event:t,listeners:o})}var kd=/\r\n?/g,Ad=/\u0000|\uFFFD/g;function jd(e){return(typeof e==`string`?e:``+e).replace(kd,`
`).replace(Ad,``)}function Md(e,t){return t=jd(t),jd(e)===t}function $(e,t,n,r,a,o){switch(n){case`children`:typeof r==`string`?t===`body`||t===`textarea`&&r===``||$t(e,r):(typeof r==`number`||typeof r==`bigint`)&&t!==`body`&&$t(e,``+r);break;case`className`:Lt(e,`class`,r);break;case`tabIndex`:Lt(e,`tabindex`,r);break;case`dir`:case`role`:case`viewBox`:case`width`:case`height`:Lt(e,n,r);break;case`style`:nn(e,r,o);break;case`data`:if(t!==`object`){Lt(e,`data`,r);break}case`src`:case`href`:if(r===``&&(t!==`a`||n!==`href`)){e.removeAttribute(n);break}if(r==null||typeof r==`function`||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=sn(``+r),e.setAttribute(n,r);break;case`action`:case`formAction`:if(typeof r==`function`){e.setAttribute(n,`javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')`);break}else typeof o==`function`&&(n===`formAction`?(t!==`input`&&$(e,t,`name`,a.name,a,null),$(e,t,`formEncType`,a.formEncType,a,null),$(e,t,`formMethod`,a.formMethod,a,null),$(e,t,`formTarget`,a.formTarget,a,null)):($(e,t,`encType`,a.encType,a,null),$(e,t,`method`,a.method,a,null),$(e,t,`target`,a.target,a,null)));if(r==null||typeof r==`symbol`||typeof r==`boolean`){e.removeAttribute(n);break}r=sn(``+r),e.setAttribute(n,r);break;case`onClick`:r!=null&&(e.onclick=cn);break;case`onScroll`:r!=null&&Q(`scroll`,e);break;case`onScrollEnd`:r!=null&&Q(`scrollend`,e);break;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));e.innerHTML=n}}break;case`multiple`:e.multiple=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`muted`:e.muted=r&&typeof r!=`function`&&typeof r!=`symbol`;break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`defaultValue`:case`defaultChecked`:case`innerHTML`:case`ref`:break;case`autoFocus`:break;case`xlinkHref`:if(r==null||typeof r==`function`||typeof r==`boolean`||typeof r==`symbol`){e.removeAttribute(`xlink:href`);break}n=sn(``+r),e.setAttributeNS(`http://www.w3.org/1999/xlink`,`xlink:href`,n);break;case`contentEditable`:case`spellCheck`:case`draggable`:case`value`:case`autoReverse`:case`externalResourcesRequired`:case`focusable`:case`preserveAlpha`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,``+r):e.removeAttribute(n);break;case`inert`:case`allowFullScreen`:case`async`:case`autoPlay`:case`controls`:case`default`:case`defer`:case`disabled`:case`disablePictureInPicture`:case`disableRemotePlayback`:case`formNoValidate`:case`hidden`:case`loop`:case`noModule`:case`noValidate`:case`open`:case`playsInline`:case`readOnly`:case`required`:case`reversed`:case`scoped`:case`seamless`:case`itemScope`:r&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,``):e.removeAttribute(n);break;case`capture`:case`download`:!0===r?e.setAttribute(n,``):!1!==r&&r!=null&&typeof r!=`function`&&typeof r!=`symbol`?e.setAttribute(n,r):e.removeAttribute(n);break;case`cols`:case`rows`:case`size`:case`span`:r!=null&&typeof r!=`function`&&typeof r!=`symbol`&&!isNaN(r)&&1<=r?e.setAttribute(n,r):e.removeAttribute(n);break;case`rowSpan`:case`start`:r==null||typeof r==`function`||typeof r==`symbol`||isNaN(r)?e.removeAttribute(n):e.setAttribute(n,r);break;case`popover`:Q(`beforetoggle`,e),Q(`toggle`,e),It(e,`popover`,r);break;case`xlinkActuate`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:actuate`,r);break;case`xlinkArcrole`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:arcrole`,r);break;case`xlinkRole`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:role`,r);break;case`xlinkShow`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:show`,r);break;case`xlinkTitle`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:title`,r);break;case`xlinkType`:Rt(e,`http://www.w3.org/1999/xlink`,`xlink:type`,r);break;case`xmlBase`:Rt(e,`http://www.w3.org/XML/1998/namespace`,`xml:base`,r);break;case`xmlLang`:Rt(e,`http://www.w3.org/XML/1998/namespace`,`xml:lang`,r);break;case`xmlSpace`:Rt(e,`http://www.w3.org/XML/1998/namespace`,`xml:space`,r);break;case`is`:It(e,`is`,r);break;case`innerText`:case`textContent`:break;default:(!(2<n.length)||n[0]!==`o`&&n[0]!==`O`||n[1]!==`n`&&n[1]!==`N`)&&(n=an.get(n)||n,It(e,n,r))}}function Nd(e,t,n,r,a,o){switch(n){case`style`:nn(e,r,o);break;case`dangerouslySetInnerHTML`:if(r!=null){if(typeof r!=`object`||!(`__html`in r))throw Error(i(61));if(n=r.__html,n!=null){if(a.children!=null)throw Error(i(60));e.innerHTML=n}}break;case`children`:typeof r==`string`?$t(e,r):(typeof r==`number`||typeof r==`bigint`)&&$t(e,``+r);break;case`onScroll`:r!=null&&Q(`scroll`,e);break;case`onScrollEnd`:r!=null&&Q(`scrollend`,e);break;case`onClick`:r!=null&&(e.onclick=cn);break;case`suppressContentEditableWarning`:case`suppressHydrationWarning`:case`innerHTML`:case`ref`:break;case`innerText`:case`textContent`:break;default:if(!kt.hasOwnProperty(n))a:{if(n[0]===`o`&&n[1]===`n`&&(a=n.endsWith(`Capture`),t=n.slice(2,a?n.length-7:void 0),o=e[gt]||null,o=o==null?null:o[n],typeof o==`function`&&e.removeEventListener(t,o,a),typeof r==`function`)){typeof o!=`function`&&o!==null&&(n in e?e[n]=null:e.hasAttribute(n)&&e.removeAttribute(n)),e.addEventListener(t,r,a);break a}n in e?e[n]=r:!0===r?e.setAttribute(n,``):It(e,n,r)}}}function Pd(e,t,n){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`img`:Q(`error`,e),Q(`load`,e);var r=!1,a=!1,o;for(o in n)if(n.hasOwnProperty(o)){var s=n[o];if(s!=null)switch(o){case`src`:r=!0;break;case`srcSet`:a=!0;break;case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:$(e,t,o,s,n,null)}}a&&$(e,t,`srcSet`,n.srcSet,n,null),r&&$(e,t,`src`,n.src,n,null);return;case`input`:Q(`invalid`,e);var c=o=s=a=null,l=null,u=null;for(r in n)if(n.hasOwnProperty(r)){var d=n[r];if(d!=null)switch(r){case`name`:a=d;break;case`type`:s=d;break;case`checked`:l=d;break;case`defaultChecked`:u=d;break;case`value`:o=d;break;case`defaultValue`:c=d;break;case`children`:case`dangerouslySetInnerHTML`:if(d!=null)throw Error(i(137,t));break;default:$(e,t,r,d,n,null)}}Jt(e,o,c,l,u,s,a,!1);return;case`select`:for(a in Q(`invalid`,e),r=s=o=null,n)if(n.hasOwnProperty(a)&&(c=n[a],c!=null))switch(a){case`value`:o=c;break;case`defaultValue`:s=c;break;case`multiple`:r=c;default:$(e,t,a,c,n,null)}t=o,n=s,e.multiple=!!r,t==null?n!=null&&Xt(e,!!r,n,!0):Xt(e,!!r,t,!1);return;case`textarea`:for(s in Q(`invalid`,e),o=a=r=null,n)if(n.hasOwnProperty(s)&&(c=n[s],c!=null))switch(s){case`value`:r=c;break;case`defaultValue`:a=c;break;case`children`:o=c;break;case`dangerouslySetInnerHTML`:if(c!=null)throw Error(i(91));break;default:$(e,t,s,c,n,null)}Qt(e,r,a,o);return;case`option`:for(l in n)if(n.hasOwnProperty(l)&&(r=n[l],r!=null))switch(l){case`selected`:e.selected=r&&typeof r!=`function`&&typeof r!=`symbol`;break;default:$(e,t,l,r,n,null)}return;case`dialog`:Q(`beforetoggle`,e),Q(`toggle`,e),Q(`cancel`,e),Q(`close`,e);break;case`iframe`:case`object`:Q(`load`,e);break;case`video`:case`audio`:for(r=0;r<_d.length;r++)Q(_d[r],e);break;case`image`:Q(`error`,e),Q(`load`,e);break;case`details`:Q(`toggle`,e);break;case`embed`:case`source`:case`link`:Q(`error`,e),Q(`load`,e);case`area`:case`base`:case`br`:case`col`:case`hr`:case`keygen`:case`meta`:case`param`:case`track`:case`wbr`:case`menuitem`:for(u in n)if(n.hasOwnProperty(u)&&(r=n[u],r!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:throw Error(i(137,t));default:$(e,t,u,r,n,null)}return;default:if(rn(t)){for(d in n)n.hasOwnProperty(d)&&(r=n[d],r!==void 0&&Nd(e,t,d,r,n,void 0));return}}for(c in n)n.hasOwnProperty(c)&&(r=n[c],r!=null&&$(e,t,c,r,n,null))}function Fd(e,t,n,r){switch(t){case`div`:case`span`:case`svg`:case`path`:case`a`:case`g`:case`p`:case`li`:break;case`input`:var a=null,o=null,s=null,c=null,l=null,u=null,d=null;for(m in n){var f=n[m];if(n.hasOwnProperty(m)&&f!=null)switch(m){case`checked`:break;case`value`:break;case`defaultValue`:l=f;default:r.hasOwnProperty(m)||$(e,t,m,null,r,f)}}for(var p in r){var m=r[p];if(f=n[p],r.hasOwnProperty(p)&&(m!=null||f!=null))switch(p){case`type`:o=m;break;case`name`:a=m;break;case`checked`:u=m;break;case`defaultChecked`:d=m;break;case`value`:s=m;break;case`defaultValue`:c=m;break;case`children`:case`dangerouslySetInnerHTML`:if(m!=null)throw Error(i(137,t));break;default:m!==f&&$(e,t,p,m,r,f)}}qt(e,s,c,l,u,d,o,a);return;case`select`:for(o in m=s=c=p=null,n)if(l=n[o],n.hasOwnProperty(o)&&l!=null)switch(o){case`value`:break;case`multiple`:m=l;default:r.hasOwnProperty(o)||$(e,t,o,null,r,l)}for(a in r)if(o=r[a],l=n[a],r.hasOwnProperty(a)&&(o!=null||l!=null))switch(a){case`value`:p=o;break;case`defaultValue`:c=o;break;case`multiple`:s=o;default:o!==l&&$(e,t,a,o,r,l)}t=c,n=s,r=m,p==null?!!r!=!!n&&(t==null?Xt(e,!!n,n?[]:``,!1):Xt(e,!!n,t,!0)):Xt(e,!!n,p,!1);return;case`textarea`:for(c in m=p=null,n)if(a=n[c],n.hasOwnProperty(c)&&a!=null&&!r.hasOwnProperty(c))switch(c){case`value`:break;case`children`:break;default:$(e,t,c,null,r,a)}for(s in r)if(a=r[s],o=n[s],r.hasOwnProperty(s)&&(a!=null||o!=null))switch(s){case`value`:p=a;break;case`defaultValue`:m=a;break;case`children`:break;case`dangerouslySetInnerHTML`:if(a!=null)throw Error(i(91));break;default:a!==o&&$(e,t,s,a,r,o)}Zt(e,p,m);return;case`option`:for(var h in n)if(p=n[h],n.hasOwnProperty(h)&&p!=null&&!r.hasOwnProperty(h))switch(h){case`selected`:e.selected=!1;break;default:$(e,t,h,null,r,p)}for(l in r)if(p=r[l],m=n[l],r.hasOwnProperty(l)&&p!==m&&(p!=null||m!=null))switch(l){case`selected`:e.selected=p&&typeof p!=`function`&&typeof p!=`symbol`;break;default:$(e,t,l,p,r,m)}return;case`img`:case`link`:case`area`:case`base`:case`br`:case`col`:case`embed`:case`hr`:case`keygen`:case`meta`:case`param`:case`source`:case`track`:case`wbr`:case`menuitem`:for(var g in n)p=n[g],n.hasOwnProperty(g)&&p!=null&&!r.hasOwnProperty(g)&&$(e,t,g,null,r,p);for(u in r)if(p=r[u],m=n[u],r.hasOwnProperty(u)&&p!==m&&(p!=null||m!=null))switch(u){case`children`:case`dangerouslySetInnerHTML`:if(p!=null)throw Error(i(137,t));break;default:$(e,t,u,p,r,m)}return;default:if(rn(t)){for(var _ in n)p=n[_],n.hasOwnProperty(_)&&p!==void 0&&!r.hasOwnProperty(_)&&Nd(e,t,_,void 0,r,p);for(d in r)p=r[d],m=n[d],!r.hasOwnProperty(d)||p===m||p===void 0&&m===void 0||Nd(e,t,d,p,r,m);return}}for(var v in n)p=n[v],n.hasOwnProperty(v)&&p!=null&&!r.hasOwnProperty(v)&&$(e,t,v,null,r,p);for(f in r)p=r[f],m=n[f],!r.hasOwnProperty(f)||p===m||p==null&&m==null||$(e,t,f,p,r,m)}function Id(e){switch(e){case`css`:case`script`:case`font`:case`img`:case`image`:case`input`:case`link`:return!0;default:return!1}}function Ld(){if(typeof performance.getEntriesByType==`function`){for(var e=0,t=0,n=performance.getEntriesByType(`resource`),r=0;r<n.length;r++){var i=n[r],a=i.transferSize,o=i.initiatorType,s=i.duration;if(a&&s&&Id(o)){for(o=0,s=i.responseEnd,r+=1;r<n.length;r++){var c=n[r],l=c.startTime;if(l>s)break;var u=c.transferSize,d=c.initiatorType;u&&Id(d)&&(c=c.responseEnd,o+=u*(c<s?1:(s-l)/(c-l)))}if(--r,t+=8*(a+o)/(i.duration/1e3),e++,10<e)break}}if(0<e)return t/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e==`number`)?e:5}var Rd=null,zd=null;function Bd(e){return e.nodeType===9?e:e.ownerDocument}function Vd(e){switch(e){case`http://www.w3.org/2000/svg`:return 1;case`http://www.w3.org/1998/Math/MathML`:return 2;default:return 0}}function Hd(e,t){if(e===0)switch(t){case`svg`:return 1;case`math`:return 2;default:return 0}return e===1&&t===`foreignObject`?0:e}function Ud(e,t){return e===`textarea`||e===`noscript`||typeof t.children==`string`||typeof t.children==`number`||typeof t.children==`bigint`||typeof t.dangerouslySetInnerHTML==`object`&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var Wd=null;function Gd(){var e=window.event;return e&&e.type===`popstate`?e===Wd?!1:(Wd=e,!0):(Wd=null,!1)}var Kd=typeof setTimeout==`function`?setTimeout:void 0,qd=typeof clearTimeout==`function`?clearTimeout:void 0,Jd=typeof Promise==`function`?Promise:void 0,Yd=typeof queueMicrotask==`function`?queueMicrotask:Jd===void 0?Kd:function(e){return Jd.resolve(null).then(e).catch(Xd)};function Xd(e){setTimeout(function(){throw e})}function Zd(e){return e===`head`}function Qd(e,t){var n=t,r=0;do{var i=n.nextSibling;if(e.removeChild(n),i&&i.nodeType===8)if(n=i.data,n===`/$`||n===`/&`){if(r===0){e.removeChild(i),Np(t);return}r--}else if(n===`$`||n===`$?`||n===`$~`||n===`$!`||n===`&`)r++;else if(n===`html`)pf(e.ownerDocument.documentElement);else if(n===`head`){n=e.ownerDocument.head,pf(n);for(var a=n.firstChild;a;){var o=a.nextSibling,s=a.nodeName;a[St]||s===`SCRIPT`||s===`STYLE`||s===`LINK`&&a.rel.toLowerCase()===`stylesheet`||n.removeChild(a),a=o}}else n===`body`&&pf(e.ownerDocument.body);n=i}while(n);Np(t)}function $d(e,t){var n=e;e=0;do{var r=n.nextSibling;if(n.nodeType===1?t?(n._stashedDisplay=n.style.display,n.style.display=`none`):(n.style.display=n._stashedDisplay||``,n.getAttribute(`style`)===``&&n.removeAttribute(`style`)):n.nodeType===3&&(t?(n._stashedText=n.nodeValue,n.nodeValue=``):n.nodeValue=n._stashedText||``),r&&r.nodeType===8)if(n=r.data,n===`/$`){if(e===0)break;e--}else n!==`$`&&n!==`$?`&&n!==`$~`&&n!==`$!`||e++;n=r}while(n)}function ef(e){var t=e.firstChild;for(t&&t.nodeType===10&&(t=t.nextSibling);t;){var n=t;switch(t=t.nextSibling,n.nodeName){case`HTML`:case`HEAD`:case`BODY`:ef(n),Ct(n);continue;case`SCRIPT`:case`STYLE`:continue;case`LINK`:if(n.rel.toLowerCase()===`stylesheet`)continue}e.removeChild(n)}}function tf(e,t,n,r){for(;e.nodeType===1;){var i=n;if(e.nodeName.toLowerCase()!==t.toLowerCase()){if(!r&&(e.nodeName!==`INPUT`||e.type!==`hidden`))break}else if(!r)if(t===`input`&&e.type===`hidden`){var a=i.name==null?null:``+i.name;if(i.type===`hidden`&&e.getAttribute(`name`)===a)return e}else return e;else if(!e[St])switch(t){case`meta`:if(!e.hasAttribute(`itemprop`))break;return e;case`link`:if(a=e.getAttribute(`rel`),a===`stylesheet`&&e.hasAttribute(`data-precedence`)||a!==i.rel||e.getAttribute(`href`)!==(i.href==null||i.href===``?null:i.href)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin)||e.getAttribute(`title`)!==(i.title==null?null:i.title))break;return e;case`style`:if(e.hasAttribute(`data-precedence`))break;return e;case`script`:if(a=e.getAttribute(`src`),(a!==(i.src==null?null:i.src)||e.getAttribute(`type`)!==(i.type==null?null:i.type)||e.getAttribute(`crossorigin`)!==(i.crossOrigin==null?null:i.crossOrigin))&&a&&e.hasAttribute(`async`)&&!e.hasAttribute(`itemprop`))break;return e;default:return e}if(e=cf(e.nextSibling),e===null)break}return null}function nf(e,t,n){if(t===``)return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!n||(e=cf(e.nextSibling),e===null))return null;return e}function rf(e,t){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!==`INPUT`||e.type!==`hidden`)&&!t||(e=cf(e.nextSibling),e===null))return null;return e}function af(e){return e.data===`$?`||e.data===`$~`}function of(e){return e.data===`$!`||e.data===`$?`&&e.ownerDocument.readyState!==`loading`}function sf(e,t){var n=e.ownerDocument;if(e.data===`$~`)e._reactRetry=t;else if(e.data!==`$?`||n.readyState!==`loading`)t();else{var r=function(){t(),n.removeEventListener(`DOMContentLoaded`,r)};n.addEventListener(`DOMContentLoaded`,r),e._reactRetry=r}}function cf(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t===`$`||t===`$!`||t===`$?`||t===`$~`||t===`&`||t===`F!`||t===`F`)break;if(t===`/$`||t===`/&`)return null}}return e}var lf=null;function uf(e){e=e.nextSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`/$`||n===`/&`){if(t===0)return cf(e.nextSibling);t--}else n!==`$`&&n!==`$!`&&n!==`$?`&&n!==`$~`&&n!==`&`||t++}e=e.nextSibling}return null}function df(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n===`$`||n===`$!`||n===`$?`||n===`$~`||n===`&`){if(t===0)return e;t--}else n!==`/$`&&n!==`/&`||t++}e=e.previousSibling}return null}function ff(e,t,n){switch(t=Bd(n),e){case`html`:if(e=t.documentElement,!e)throw Error(i(452));return e;case`head`:if(e=t.head,!e)throw Error(i(453));return e;case`body`:if(e=t.body,!e)throw Error(i(454));return e;default:throw Error(i(451))}}function pf(e){for(var t=e.attributes;t.length;)e.removeAttributeNode(t[0]);Ct(e)}var mf=new Map,hf=new Set;function gf(e){return typeof e.getRootNode==`function`?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var _f=E.d;E.d={f:vf,r:yf,D:Sf,C:Cf,L:wf,m:Tf,X:Df,S:Ef,M:Of};function vf(){var e=_f.f(),t=bu();return e||t}function yf(e){var t=Tt(e);t!==null&&t.tag===5&&t.type===`form`?As(t):_f.r(e)}var bf=typeof document>`u`?null:document;function xf(e,t,n){var r=bf;if(r&&typeof t==`string`&&t){var i=Kt(t);i=`link[rel="`+e+`"][href="`+i+`"]`,typeof n==`string`&&(i+=`[crossorigin="`+n+`"]`),hf.has(i)||(hf.add(i),e={rel:e,crossOrigin:n,href:t},r.querySelector(i)===null&&(t=r.createElement(`link`),Pd(t,`link`,e),A(t),r.head.appendChild(t)))}}function Sf(e){_f.D(e),xf(`dns-prefetch`,e,null)}function Cf(e,t){_f.C(e,t),xf(`preconnect`,e,t)}function wf(e,t,n){_f.L(e,t,n);var r=bf;if(r&&e&&t){var i=`link[rel="preload"][as="`+Kt(t)+`"]`;t===`image`&&n&&n.imageSrcSet?(i+=`[imagesrcset="`+Kt(n.imageSrcSet)+`"]`,typeof n.imageSizes==`string`&&(i+=`[imagesizes="`+Kt(n.imageSizes)+`"]`)):i+=`[href="`+Kt(e)+`"]`;var a=i;switch(t){case`style`:a=Af(e);break;case`script`:a=Pf(e)}mf.has(a)||(e=h({rel:`preload`,href:t===`image`&&n&&n.imageSrcSet?void 0:e,as:t},n),mf.set(a,e),r.querySelector(i)!==null||t===`style`&&r.querySelector(jf(a))||t===`script`&&r.querySelector(Ff(a))||(t=r.createElement(`link`),Pd(t,`link`,e),A(t),r.head.appendChild(t)))}}function Tf(e,t){_f.m(e,t);var n=bf;if(n&&e){var r=t&&typeof t.as==`string`?t.as:`script`,i=`link[rel="modulepreload"][as="`+Kt(r)+`"][href="`+Kt(e)+`"]`,a=i;switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:a=Pf(e)}if(!mf.has(a)&&(e=h({rel:`modulepreload`,href:e},t),mf.set(a,e),n.querySelector(i)===null)){switch(r){case`audioworklet`:case`paintworklet`:case`serviceworker`:case`sharedworker`:case`worker`:case`script`:if(n.querySelector(Ff(a)))return}r=n.createElement(`link`),Pd(r,`link`,e),A(r),n.head.appendChild(r)}}}function Ef(e,t,n){_f.S(e,t,n);var r=bf;if(r&&e){var i=Dt(r).hoistableStyles,a=Af(e);t||=`default`;var o=i.get(a);if(!o){var s={loading:0,preload:null};if(o=r.querySelector(jf(a)))s.loading=5;else{e=h({rel:`stylesheet`,href:e,"data-precedence":t},n),(n=mf.get(a))&&Rf(e,n);var c=o=r.createElement(`link`);A(c),Pd(c,`link`,e),c._p=new Promise(function(e,t){c.onload=e,c.onerror=t}),c.addEventListener(`load`,function(){s.loading|=1}),c.addEventListener(`error`,function(){s.loading|=2}),s.loading|=4,Lf(o,t,r)}o={type:`stylesheet`,instance:o,count:1,state:s},i.set(a,o)}}}function Df(e,t){_f.X(e,t);var n=bf;if(n&&e){var r=Dt(n).hoistableScripts,i=Pf(e),a=r.get(i);a||(a=n.querySelector(Ff(i)),a||(e=h({src:e,async:!0},t),(t=mf.get(i))&&zf(e,t),a=n.createElement(`script`),A(a),Pd(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function Of(e,t){_f.M(e,t);var n=bf;if(n&&e){var r=Dt(n).hoistableScripts,i=Pf(e),a=r.get(i);a||(a=n.querySelector(Ff(i)),a||(e=h({src:e,async:!0,type:`module`},t),(t=mf.get(i))&&zf(e,t),a=n.createElement(`script`),A(a),Pd(a,`link`,e),n.head.appendChild(a)),a={type:`script`,instance:a,count:1,state:null},r.set(i,a))}}function kf(e,t,n,r){var a=(a=ge.current)?gf(a):null;if(!a)throw Error(i(446));switch(e){case`meta`:case`title`:return null;case`style`:return typeof n.precedence==`string`&&typeof n.href==`string`?(t=Af(n.href),n=Dt(a).hoistableStyles,r=n.get(t),r||(r={type:`style`,instance:null,count:0,state:null},n.set(t,r)),r):{type:`void`,instance:null,count:0,state:null};case`link`:if(n.rel===`stylesheet`&&typeof n.href==`string`&&typeof n.precedence==`string`){e=Af(n.href);var o=Dt(a).hoistableStyles,s=o.get(e);if(s||(a=a.ownerDocument||a,s={type:`stylesheet`,instance:null,count:0,state:{loading:0,preload:null}},o.set(e,s),(o=a.querySelector(jf(e)))&&!o._p&&(s.instance=o,s.state.loading=5),mf.has(e)||(n={rel:`preload`,as:`style`,href:n.href,crossOrigin:n.crossOrigin,integrity:n.integrity,media:n.media,hrefLang:n.hrefLang,referrerPolicy:n.referrerPolicy},mf.set(e,n),o||Nf(a,e,n,s.state))),t&&r===null)throw Error(i(528,``));return s}if(t&&r!==null)throw Error(i(529,``));return null;case`script`:return t=n.async,n=n.src,typeof n==`string`&&t&&typeof t!=`function`&&typeof t!=`symbol`?(t=Pf(n),n=Dt(a).hoistableScripts,r=n.get(t),r||(r={type:`script`,instance:null,count:0,state:null},n.set(t,r)),r):{type:`void`,instance:null,count:0,state:null};default:throw Error(i(444,e))}}function Af(e){return`href="`+Kt(e)+`"`}function jf(e){return`link[rel="stylesheet"][`+e+`]`}function Mf(e){return h({},e,{"data-precedence":e.precedence,precedence:null})}function Nf(e,t,n,r){e.querySelector(`link[rel="preload"][as="style"][`+t+`]`)?r.loading=1:(t=e.createElement(`link`),r.preload=t,t.addEventListener(`load`,function(){return r.loading|=1}),t.addEventListener(`error`,function(){return r.loading|=2}),Pd(t,`link`,n),A(t),e.head.appendChild(t))}function Pf(e){return`[src="`+Kt(e)+`"]`}function Ff(e){return`script[async]`+e}function If(e,t,n){if(t.count++,t.instance===null)switch(t.type){case`style`:var r=e.querySelector(`style[data-href~="`+Kt(n.href)+`"]`);if(r)return t.instance=r,A(r),r;var a=h({},n,{"data-href":n.href,"data-precedence":n.precedence,href:null,precedence:null});return r=(e.ownerDocument||e).createElement(`style`),A(r),Pd(r,`style`,a),Lf(r,n.precedence,e),t.instance=r;case`stylesheet`:a=Af(n.href);var o=e.querySelector(jf(a));if(o)return t.state.loading|=4,t.instance=o,A(o),o;r=Mf(n),(a=mf.get(a))&&Rf(r,a),o=(e.ownerDocument||e).createElement(`link`),A(o);var s=o;return s._p=new Promise(function(e,t){s.onload=e,s.onerror=t}),Pd(o,`link`,r),t.state.loading|=4,Lf(o,n.precedence,e),t.instance=o;case`script`:return o=Pf(n.src),(a=e.querySelector(Ff(o)))?(t.instance=a,A(a),a):(r=n,(a=mf.get(o))&&(r=h({},n),zf(r,a)),e=e.ownerDocument||e,a=e.createElement(`script`),A(a),Pd(a,`link`,r),e.head.appendChild(a),t.instance=a);case`void`:return null;default:throw Error(i(443,t.type))}else t.type===`stylesheet`&&!(t.state.loading&4)&&(r=t.instance,t.state.loading|=4,Lf(r,n.precedence,e));return t.instance}function Lf(e,t,n){for(var r=n.querySelectorAll(`link[rel="stylesheet"][data-precedence],style[data-precedence]`),i=r.length?r[r.length-1]:null,a=i,o=0;o<r.length;o++){var s=r[o];if(s.dataset.precedence===t)a=s;else if(a!==i)break}a?a.parentNode.insertBefore(e,a.nextSibling):(t=n.nodeType===9?n.head:n,t.insertBefore(e,t.firstChild))}function Rf(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.title??=t.title}function zf(e,t){e.crossOrigin??=t.crossOrigin,e.referrerPolicy??=t.referrerPolicy,e.integrity??=t.integrity}var Bf=null;function Vf(e,t,n){if(Bf===null){var r=new Map,i=Bf=new Map;i.set(n,r)}else i=Bf,r=i.get(n),r||(r=new Map,i.set(n,r));if(r.has(e))return r;for(r.set(e,null),n=n.getElementsByTagName(e),i=0;i<n.length;i++){var a=n[i];if(!(a[St]||a[ht]||e===`link`&&a.getAttribute(`rel`)===`stylesheet`)&&a.namespaceURI!==`http://www.w3.org/2000/svg`){var o=a.getAttribute(t)||``;o=e+o;var s=r.get(o);s?s.push(a):r.set(o,[a])}}return r}function Hf(e,t,n){e=e.ownerDocument||e,e.head.insertBefore(n,t===`title`?e.querySelector(`head > title`):null)}function Uf(e,t,n){if(n===1||t.itemProp!=null)return!1;switch(e){case`meta`:case`title`:return!0;case`style`:if(typeof t.precedence!=`string`||typeof t.href!=`string`||t.href===``)break;return!0;case`link`:if(typeof t.rel!=`string`||typeof t.href!=`string`||t.href===``||t.onLoad||t.onError)break;switch(t.rel){case`stylesheet`:return e=t.disabled,typeof t.precedence==`string`&&e==null;default:return!0}case`script`:if(t.async&&typeof t.async!=`function`&&typeof t.async!=`symbol`&&!t.onLoad&&!t.onError&&t.src&&typeof t.src==`string`)return!0}return!1}function Wf(e){return!(e.type===`stylesheet`&&!(e.state.loading&3))}function Gf(e,t,n,r){if(n.type===`stylesheet`&&(typeof r.media!=`string`||!1!==matchMedia(r.media).matches)&&!(n.state.loading&4)){if(n.instance===null){var i=Af(r.href),a=t.querySelector(jf(i));if(a){t=a._p,typeof t==`object`&&t&&typeof t.then==`function`&&(e.count++,e=Jf.bind(e),t.then(e,e)),n.state.loading|=4,n.instance=a,A(a);return}a=t.ownerDocument||t,r=Mf(r),(i=mf.get(i))&&Rf(r,i),a=a.createElement(`link`),A(a);var o=a;o._p=new Promise(function(e,t){o.onload=e,o.onerror=t}),Pd(a,`link`,r),n.instance=a}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(n,t),(t=n.state.preload)&&!(n.state.loading&3)&&(e.count++,n=Jf.bind(e),t.addEventListener(`load`,n),t.addEventListener(`error`,n))}}var Kf=0;function qf(e,t){return e.stylesheets&&e.count===0&&Xf(e,e.stylesheets),0<e.count||0<e.imgCount?function(n){var r=setTimeout(function(){if(e.stylesheets&&Xf(e,e.stylesheets),e.unsuspend){var t=e.unsuspend;e.unsuspend=null,t()}},6e4+t);0<e.imgBytes&&Kf===0&&(Kf=62500*Ld());var i=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Xf(e,e.stylesheets),e.unsuspend)){var t=e.unsuspend;e.unsuspend=null,t()}},(e.imgBytes>Kf?50:800)+t);return e.unsuspend=n,function(){e.unsuspend=null,clearTimeout(r),clearTimeout(i)}}:null}function Jf(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Xf(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var Yf=null;function Xf(e,t){e.stylesheets=null,e.unsuspend!==null&&(e.count++,Yf=new Map,t.forEach(Zf,e),Yf=null,Jf.call(e))}function Zf(e,t){if(!(t.state.loading&4)){var n=Yf.get(e);if(n)var r=n.get(null);else{n=new Map,Yf.set(e,n);for(var i=e.querySelectorAll(`link[data-precedence],style[data-precedence]`),a=0;a<i.length;a++){var o=i[a];(o.nodeName===`LINK`||o.getAttribute(`media`)!==`not all`)&&(n.set(o.dataset.precedence,o),r=o)}r&&n.set(null,r)}i=t.instance,o=i.getAttribute(`data-precedence`),a=n.get(o)||r,a===r&&n.set(null,i),n.set(o,i),this.count++,r=Jf.bind(this),i.addEventListener(`load`,r),i.addEventListener(`error`,r),a?a.parentNode.insertBefore(i,a.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(i,e.firstChild)),t.state.loading|=4}}var Qf={$$typeof:S,Provider:null,Consumer:null,_currentValue:de,_currentValue2:de,_threadCount:0};function $f(e,t,n,r,i,a,o,s,c){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=it(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=it(0),this.hiddenUpdates=it(null),this.identifierPrefix=r,this.onUncaughtError=i,this.onCaughtError=a,this.onRecoverableError=o,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=c,this.incompleteTransitions=new Map}function ep(e,t,n,r,i,a,o,s,c,l,u,d){return e=new $f(e,t,n,o,c,l,u,d,s),t=1,!0===a&&(t|=24),a=gi(3,null,null,t),e.current=a,a.stateNode=e,t=ma(),t.refCount++,e.pooledCache=t,t.refCount++,a.memoizedState={element:r,isDehydrated:n,cache:t},qa(a),e}function tp(e){return e?(e=mi,e):mi}function np(e,t,n,r,i,a){i=tp(i),r.context===null?r.context=i:r.pendingContext=i,r=Ya(t),r.payload={element:n},a=a===void 0?null:a,a!==null&&(r.callback=a),n=Xa(e,r,t),n!==null&&(hu(n,e,t),Za(n,e,t))}function rp(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function ip(e,t){rp(e,t),(e=e.alternate)&&rp(e,t)}function ap(e){if(e.tag===13||e.tag===31){var t=di(e,67108864);t!==null&&hu(t,e,67108864),ip(e,67108864)}}function op(e){if(e.tag===13||e.tag===31){var t=pu();t=ut(t);var n=di(e,t);n!==null&&hu(n,e,t),ip(e,t)}}var sp=!0;function cp(e,t,n,r){var i=T.T;T.T=null;var a=E.p;try{E.p=2,up(e,t,n,r)}finally{E.p=a,T.T=i}}function lp(e,t,n,r){var i=T.T;T.T=null;var a=E.p;try{E.p=8,up(e,t,n,r)}finally{E.p=a,T.T=i}}function up(e,t,n,r){if(sp){var i=dp(r);if(i===null)wd(e,t,r,fp,n),Cp(e,r);else if(Tp(i,e,t,n,r))r.stopPropagation();else if(Cp(e,r),t&4&&-1<Sp.indexOf(e)){for(;i!==null;){var a=Tt(i);if(a!==null)switch(a.tag){case 3:if(a=a.stateNode,a.current.memoizedState.isDehydrated){var o=$e(a.pendingLanes);if(o!==0){var s=a;for(s.pendingLanes|=2,s.entangledLanes|=2;o;){var c=1<<31-Ke(o);s.entanglements[1]|=c,o&=~c}rd(a),!(W&6)&&(nu=Pe()+500,id(0,!1))}}break;case 31:case 13:s=di(a,2),s!==null&&hu(s,a,2),bu(),ip(a,2)}if(a=dp(r),a===null&&wd(e,t,r,fp,n),a===i)break;i=a}i!==null&&r.stopPropagation()}else wd(e,t,r,null,n)}}function dp(e){return e=un(e),pp(e)}var fp=null;function pp(e){if(fp=null,e=wt(e),e!==null){var t=c(e);if(t===null)e=null;else{var n=t.tag;if(n===13){if(e=u(t),e!==null)return e;e=null}else if(n===31){if(e=d(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null)}}return fp=e,null}function mp(e){switch(e){case`beforetoggle`:case`cancel`:case`click`:case`close`:case`contextmenu`:case`copy`:case`cut`:case`auxclick`:case`dblclick`:case`dragend`:case`dragstart`:case`drop`:case`focusin`:case`focusout`:case`input`:case`invalid`:case`keydown`:case`keypress`:case`keyup`:case`mousedown`:case`mouseup`:case`paste`:case`pause`:case`play`:case`pointercancel`:case`pointerdown`:case`pointerup`:case`ratechange`:case`reset`:case`resize`:case`seeked`:case`submit`:case`toggle`:case`touchcancel`:case`touchend`:case`touchstart`:case`volumechange`:case`change`:case`selectionchange`:case`textInput`:case`compositionstart`:case`compositionend`:case`compositionupdate`:case`beforeblur`:case`afterblur`:case`beforeinput`:case`blur`:case`fullscreenchange`:case`focus`:case`hashchange`:case`popstate`:case`select`:case`selectstart`:return 2;case`drag`:case`dragenter`:case`dragexit`:case`dragleave`:case`dragover`:case`mousemove`:case`mouseout`:case`mouseover`:case`pointermove`:case`pointerout`:case`pointerover`:case`scroll`:case`touchmove`:case`wheel`:case`mouseenter`:case`mouseleave`:case`pointerenter`:case`pointerleave`:return 8;case`message`:switch(Fe()){case Ie:return 2;case Le:return 8;case Re:case ze:return 32;case Be:return 268435456;default:return 32}default:return 32}}var hp=!1,gp=null,_p=null,vp=null,yp=new Map,bp=new Map,xp=[],Sp=`mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset`.split(` `);function Cp(e,t){switch(e){case`focusin`:case`focusout`:gp=null;break;case`dragenter`:case`dragleave`:_p=null;break;case`mouseover`:case`mouseout`:vp=null;break;case`pointerover`:case`pointerout`:yp.delete(t.pointerId);break;case`gotpointercapture`:case`lostpointercapture`:bp.delete(t.pointerId)}}function wp(e,t,n,r,i,a){return e===null||e.nativeEvent!==a?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:a,targetContainers:[i]},t!==null&&(t=Tt(t),t!==null&&ap(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,i!==null&&t.indexOf(i)===-1&&t.push(i),e)}function Tp(e,t,n,r,i){switch(t){case`focusin`:return gp=wp(gp,e,t,n,r,i),!0;case`dragenter`:return _p=wp(_p,e,t,n,r,i),!0;case`mouseover`:return vp=wp(vp,e,t,n,r,i),!0;case`pointerover`:var a=i.pointerId;return yp.set(a,wp(yp.get(a)||null,e,t,n,r,i)),!0;case`gotpointercapture`:return a=i.pointerId,bp.set(a,wp(bp.get(a)||null,e,t,n,r,i)),!0}return!1}function Ep(e){var t=wt(e.target);if(t!==null){var n=c(t);if(n!==null){if(t=n.tag,t===13){if(t=u(n),t!==null){e.blockedOn=t,pt(e.priority,function(){op(n)});return}}else if(t===31){if(t=d(n),t!==null){e.blockedOn=t,pt(e.priority,function(){op(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Dp(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=dp(e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);ln=r,n.target.dispatchEvent(r),ln=null}else return t=Tt(n),t!==null&&ap(t),e.blockedOn=n,!1;t.shift()}return!0}function Op(e,t,n){Dp(e)&&n.delete(t)}function kp(){hp=!1,gp!==null&&Dp(gp)&&(gp=null),_p!==null&&Dp(_p)&&(_p=null),vp!==null&&Dp(vp)&&(vp=null),yp.forEach(Op),bp.forEach(Op)}function Ap(e,n){e.blockedOn===n&&(e.blockedOn=null,hp||(hp=!0,t.unstable_scheduleCallback(t.unstable_NormalPriority,kp)))}var jp=null;function Mp(e){jp!==e&&(jp=e,t.unstable_scheduleCallback(t.unstable_NormalPriority,function(){jp===e&&(jp=null);for(var t=0;t<e.length;t+=3){var n=e[t],r=e[t+1],i=e[t+2];if(typeof r!=`function`){if(pp(r||n)===null)continue;break}var a=Tt(n);a!==null&&(e.splice(t,3),t-=3,Os(a,{pending:!0,data:i,method:n.method,action:r},r,i))}}))}function Np(e){function t(t){return Ap(t,e)}gp!==null&&Ap(gp,e),_p!==null&&Ap(_p,e),vp!==null&&Ap(vp,e),yp.forEach(t),bp.forEach(t);for(var n=0;n<xp.length;n++){var r=xp[n];r.blockedOn===e&&(r.blockedOn=null)}for(;0<xp.length&&(n=xp[0],n.blockedOn===null);)Ep(n),n.blockedOn===null&&xp.shift();if(n=(e.ownerDocument||e).$$reactFormReplay,n!=null)for(r=0;r<n.length;r+=3){var i=n[r],a=n[r+1],o=i[gt]||null;if(typeof a==`function`)o||Mp(n);else if(o){var s=null;if(a&&a.hasAttribute(`formAction`)){if(i=a,o=a[gt]||null)s=o.formAction;else if(pp(i)!==null)continue}else s=o.action;typeof s==`function`?n[r+1]=s:(n.splice(r,3),r-=3),Mp(n)}}}function Pp(){function e(e){e.canIntercept&&e.info===`react-transition`&&e.intercept({handler:function(){return new Promise(function(e){return i=e})},focusReset:`manual`,scroll:`manual`})}function t(){i!==null&&(i(),i=null),r||setTimeout(n,20)}function n(){if(!r&&!navigation.transition){var e=navigation.currentEntry;e&&e.url!=null&&navigation.navigate(e.url,{state:e.getState(),info:`react-transition`,history:`replace`})}}if(typeof navigation==`object`){var r=!1,i=null;return navigation.addEventListener(`navigate`,e),navigation.addEventListener(`navigatesuccess`,t),navigation.addEventListener(`navigateerror`,t),setTimeout(n,100),function(){r=!0,navigation.removeEventListener(`navigate`,e),navigation.removeEventListener(`navigatesuccess`,t),navigation.removeEventListener(`navigateerror`,t),i!==null&&(i(),i=null)}}}function Fp(e){this._internalRoot=e}Ip.prototype.render=Fp.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(i(409));var n=t.current;np(n,pu(),e,t,null,null)},Ip.prototype.unmount=Fp.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;np(e.current,2,null,e,null,null),bu(),t[_t]=null}};function Ip(e){this._internalRoot=e}Ip.prototype.unstable_scheduleHydration=function(e){if(e){var t=ft();e={blockedOn:null,target:e,priority:t};for(var n=0;n<xp.length&&t!==0&&t<xp[n].priority;n++);xp.splice(n,0,e),n===0&&Ep(e)}};var Lp=n.version;if(Lp!==`19.2.7`)throw Error(i(527,Lp,`19.2.7`));E.findDOMNode=function(e){var t=e._reactInternals;if(t===void 0)throw typeof e.render==`function`?Error(i(188)):(e=Object.keys(e).join(`,`),Error(i(268,e)));return e=p(t),e=e===null?null:m(e),e=e===null?null:e.stateNode,e};var Rp={bundleType:0,version:`19.2.7`,rendererPackageName:`react-dom`,currentDispatcherRef:T,reconcilerVersion:`19.2.7`};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<`u`){var zp=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!zp.isDisabled&&zp.supportsFiber)try{Ue=zp.inject(Rp),We=zp}catch{}}e.createRoot=function(e,t){if(!o(e))throw Error(i(299));var n=!1,r=``,a=Zs,s=Qs,c=$s;return t!=null&&(!0===t.unstable_strictMode&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onUncaughtError!==void 0&&(a=t.onUncaughtError),t.onCaughtError!==void 0&&(s=t.onCaughtError),t.onRecoverableError!==void 0&&(c=t.onRecoverableError)),t=ep(e,1,!1,null,null,n,r,null,a,s,c,Pp),e[_t]=t.current,Sd(e),new Fp(t)}})),d=e(((e,t)=>{function n(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>`u`||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!=`function`))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n)}catch(e){console.error(e)}}n(),t.exports=u()})),f=a(),p=d(),m=[`(prefers-reduced-motion: reduce)`,`(pointer: fine)`,`(min-width: 900px)`];function h(){if(typeof window>`u`||typeof window.matchMedia!=`function`)return!1;let[e,t,n]=m.map(e=>window.matchMedia(e));return!e.matches&&t.matches&&n.matches}var g=e((e=>{var t=Symbol.for(`react.transitional.element`),n=Symbol.for(`react.fragment`);function r(e,n,r){var i=null;if(r!==void 0&&(i=``+r),n.key!==void 0&&(i=``+n.key),`key`in n)for(var a in r={},n)a!==`key`&&(r[a]=n[a]);else r=n;return n=r.ref,{$$typeof:t,type:e,key:i,ref:n===void 0?null:n,props:r}}e.Fragment=n,e.jsx=r,e.jsxs=r})),_=e(((e,t)=>{t.exports=g()}))();function v({seed:e=58}){let t=(0,f.useRef)(null);return(0,f.useEffect)(()=>{let n=t.current;if(!n)return;if(typeof window.matchMedia!=`function`){n.dataset.mode=`static`;return}let r=null,i=!1,a=0,o=m.map(e=>window.matchMedia(e)),s=Function(`u`,`return import(u)`),c=()=>{let t=++a;if(r&&=(r.destroy(),null),!h()){n.dataset.mode=`static`;return}delete n.dataset.mode,s(`/system/field-ground.js?v=20260718-zentropy`).then(o=>{i||t!==a||!h()||!o.isFieldGroundAvailable()||(r=o.mountFieldGround(n,{seed:e,principle:`zentropy`,wander:!1,hero:!1,reduced:!1}))}).catch(()=>{})},l=e=>{typeof e.addEventListener==`function`?e.addEventListener(`change`,c):e.addListener(c)},u=e=>{typeof e.removeEventListener==`function`?e.removeEventListener(`change`,c):e.removeListener(c)};return c(),o.forEach(l),()=>{i=!0,a+=1,o.forEach(u),r&&r.destroy()}},[e]),(0,_.jsx)(`canvas`,{ref:t,className:`ground-field`,"aria-hidden":`true`})}var y=JSON.parse(`{
  "families": [
    {
      "label": "Work",
      "routes": [
        {
          "label": "Hire / work",
          "href": "hire.html",
          "primary": true
        },
        {
          "label": "Technical support, developer operations, and QA",
          "href": "hire.html#engineering-path",
          "summary": "Technical support engineering, developer operations, implementation support, release support, and software QA."
        },
        {
          "label": "Evaluation tooling and Python developer tools",
          "href": "hire.html#technical-operations-path",
          "summary": "Evaluation tooling, Python developer tools, test infrastructure, and research-engineering support."
        },
        {
          "label": "Public service, safety, and field operations",
          "href": "hire.html#public-service-field-path",
          "summary": "Physical work, public-facing service, grounds experience, and safety-minded operations."
        },
        {
          "label": "Dossier",
          "href": "dossier.html"
        },
        {
          "label": "Resume",
          "href": "resume.html"
        },
        {
          "label": "Full CV",
          "href": "cv.html"
        },
        {
          "label": "Portfolio",
          "href": "portfolio.html"
        },
        {
          "label": "Letter",
          "href": "cover-letter.html"
        },
        {
          "label": "The person",
          "href": "person.html"
        },
        {
          "label": "Request a test run",
          "href": "test-run-request.html"
        }
      ]
    },
    {
      "label": "Systems",
      "routes": [
        {
          "label": "Systems",
          "href": "overview.html",
          "primary": true
        },
        {
          "label": "Catalog",
          "href": "catalog.html",
          "breadcrumbLabel": "Systems"
        },
        {
          "label": "Index",
          "href": "index-graph.html"
        },
        {
          "label": "Gather",
          "href": "gather.html"
        },
        {
          "label": "Forum",
          "href": "forum.html"
        },
        {
          "label": "Crucible",
          "href": "crucible.html"
        },
        {
          "label": "Learn",
          "href": "learn.html"
        },
        {
          "label": "Flywheel",
          "href": "flywheel.html"
        },
        {
          "label": "Telos",
          "href": "systems/telos.html"
        },
        {
          "label": "Relay",
          "href": "systems/relay.html"
        },
        {
          "label": "Plexus",
          "href": "systems/plexus.html"
        },
        {
          "label": "Mneme",
          "href": "systems/mneme.html"
        },
        {
          "label": "Studio Engine",
          "href": "systems/studio-engine.html"
        },
        {
          "label": "The Tour",
          "href": "tour.html"
        },
        {
          "label": "Recorded workflows",
          "href": "demonstrations.html"
        },
        {
          "label": "Index workflow",
          "href": "demo-index.html"
        },
        {
          "label": "Gather workflow",
          "href": "demo-gather.html"
        },
        {
          "label": "Forum workflow",
          "href": "demo-forum.html"
        },
        {
          "label": "Crucible workflow",
          "href": "demo-crucible.html"
        },
        {
          "label": "EMET workflow",
          "href": "demo-emet.html"
        },
        {
          "label": "Proof Index sample",
          "href": "proof-index-sample.html"
        },
        {
          "label": "Proof Surface sample",
          "href": "proof-surface-sample.html"
        },
        {
          "label": "EMET sample",
          "href": "emet-sample.html"
        },
        {
          "label": "Guide",
          "href": "guide.html"
        }
      ],
      "prefixes": [
        "systems/"
      ]
    },
    {
      "label": "Security",
      "routes": [
        {
          "label": "Security",
          "href": "security.html"
        },
        {
          "label": "Security toolkit",
          "href": "security-toolkit.html"
        },
        {
          "label": "Phantom",
          "href": "phantom.html"
        },
        {
          "label": "Authorized private practice",
          "href": "private-practice.html"
        },
        {
          "label": "Behavior Transform",
          "href": "systems/behavior-transform.html",
          "aliases": [
            "behavior-transform.html"
          ]
        },
        {
          "label": "Array",
          "href": "array.html"
        },
        {
          "label": "Seed",
          "href": "seed.html"
        },
        {
          "label": "Sofer",
          "href": "sofer.html"
        },
        {
          "label": "Isomorph",
          "href": "isomorph.html"
        },
        {
          "label": "Bounds",
          "href": "bounds.html"
        },
        {
          "label": "Kun",
          "href": "kun.html"
        },
        {
          "label": "Public Surface Sweeper sample",
          "href": "public-surface-sweeper-sample.html"
        },
        {
          "label": "Model Provenance Validator",
          "href": "security-toolkit.html#model-provenance-validator"
        },
        {
          "label": "Secret Redact IO",
          "href": "security-toolkit.html#secret-redact-io"
        },
        {
          "label": "Agent Hook Pack",
          "href": "security-toolkit.html#agent-hook-pack"
        },
        {
          "label": "Repo Proof Index",
          "href": "security-toolkit.html#repo-proof-index"
        },
        {
          "label": "EMET",
          "href": "emet.html"
        },
        {
          "label": "Proof Surface",
          "href": "proof-surface.html"
        },
        {
          "label": "Accountable Surface",
          "href": "accountable-surface.html",
          "summary": "Controlled agent actions with external authority, bounded effectors, rollback, and a durable journal."
        },
        {
          "label": "Coherence Membrane",
          "href": "coherence-membrane.html"
        },
        {
          "label": "Accountable Machines",
          "href": "accountable-machines.html"
        },
        {
          "label": "Accountable Engine",
          "href": "accountable-engine.html"
        },
        {
          "label": "BuildLang",
          "href": "buildlang.html"
        },
        {
          "label": "Build Color",
          "href": "build-color.html"
        },
        {
          "label": "Build Products",
          "href": "build-products.html"
        },
        {
          "label": "Toolkit",
          "href": "toolkit.html"
        },
        {
          "label": "Provenance Sensorium",
          "href": "provenance-sensorium.html"
        },
        {
          "label": "Checkpoint",
          "href": "aleph.html"
        },
        {
          "label": "Warden",
          "href": "warden.html"
        },
        {
          "label": "Presentation",
          "href": "presentation.html"
        },
        {
          "label": "Atelier",
          "href": "atelier.html"
        },
        {
          "label": "Quanta Color",
          "href": "quanta-color.html"
        },
        {
          "label": "Quanta Products",
          "href": "quanta-products.html"
        },
        {
          "label": "QuantaLang",
          "href": "quantalang.html"
        },
        {
          "label": "Field guide",
          "href": "field-guide.html"
        }
      ],
      "prefixes": [
        "security-"
      ]
    },
    {
      "label": "Research",
      "prefixes": [
        "research-",
        "briefings/",
        "frontier-safety/"
      ],
      "routes": [
        {
          "label": "Research",
          "href": "research.html",
          "primary": true
        },
        {
          "label": "Why",
          "href": "why.html"
        },
        {
          "label": "Writing",
          "href": "writing.html"
        },
        {
          "label": "The summary is not the record",
          "href": "the-summary-is-not-the-record.html"
        },
        {
          "label": "Publications",
          "href": "publications.html"
        },
        {
          "label": "OpenAI / Hugging Face incident",
          "href": "frontier-safety-openai-hugging-face-incident.html",
          "summary": "August 26 incident-source comparison with public-safe control-plane visualization."
        },
        {
          "label": "Frontier Safety Briefing",
          "href": "frontier-safety.html"
        },
        {
          "label": "Models propose, oracles dispose",
          "href": "models-propose-oracles-dispose.html"
        },
        {
          "label": "Chorus",
          "href": "chorus.html"
        },
        {
          "label": "Briefing archive",
          "href": "briefings/index.html"
        }
      ]
    },
    {
      "label": "Studio",
      "routes": [
        {
          "label": "The Studio",
          "href": "studio.html",
          "primary": true
        },
        {
          "label": "Gallery",
          "href": "gallery.html",
          "primary": true
        },
        {
          "label": "Retro Engine",
          "href": "retro.html",
          "primary": true
        },
        {
          "label": "Engine Revival",
          "href": "engine-revival.html"
        },
        {
          "label": "BRender Archival",
          "href": "brender-archival.html"
        },
        {
          "label": "Elder ENB",
          "href": "elder-enb.html",
          "summary": "Active Skyrim SE/AE ENB shader-suite work; branch state and live-host acceptance remain separate from public release state."
        },
        {
          "label": "Truth ENB",
          "href": "truth-enb.html",
          "summary": "Skyrim SE/AE ENBSeries 0.504 shader suite with procedural sky, clouds, aurora, exposure, tone mapping, and an optional camera bridge."
        },
        {
          "label": "ENB Runtime Core",
          "href": "enb-runtime-core.html",
          "summary": "Runtime integration core for an already-loaded ENBSeries host."
        },
        {
          "label": "SkyrimBridge",
          "href": "skyrimbridge.html",
          "summary": "Public Skyrim integration bridge whose default build excludes the native replacement suite."
        },
        {
          "label": "RAW",
          "href": "raw.html",
          "breadcrumbLabel": "Graphics and media"
        },
        {
          "label": "The Loom",
          "href": "loom.html"
        },
        {
          "label": "Gaussian splats",
          "href": "gaussian-splats.html"
        },
        {
          "label": "Current story",
          "href": "current-story.html"
        },
        {
          "label": "Poster",
          "href": "studio.html?source=poster"
        },
        {
          "label": "Typeface",
          "href": "typeface.html"
        },
        {
          "label": "Session archive",
          "href": "session-archive.html"
        }
      ]
    }
  ],
  "externalActions": [
    {
      "label": "GitHub ↗",
      "href": "https://github.com/HarperZ9",
      "external": true
    }
  ]
}`),b=y.families.flatMap(e=>e.routes.filter(e=>e.primary).map(t=>({...t,family:e.label,primary:!0}))),x=y.families.map(e=>({label:e.label,routes:e.routes.filter(e=>!e.primary).map(t=>({...t,family:e.label,primary:!1}))})).filter(e=>e.routes.length),ee=y.externalActions;function S(e){try{let t=new URL(e||`index.html`,`https://harperz9.github.io/`),n=t.pathname.replace(/^\//,``);return n?n.endsWith(`/`)?n+=`index.html`:(n.split(`/`).pop()||``).includes(`.`)||(n+=`.html`):n=`index.html`,n+t.search+t.hash}catch{return``}}function C(e){let t=S(e),n=t.split(`#`)[0].split(`?`)[0];for(let e of y.families)if(e.routes.some(e=>{let r=S(e.href);return r===t||r.split(`#`)[0].split(`?`)[0]===n?!0:(e.aliases||[]).some(e=>{let r=S(e);return r===t||r.split(`#`)[0].split(`?`)[0]===n})}))return e.label;for(let e of y.families){let t=n.replace(/\.html$/,``);if((e.prefixes||[]).some(e=>t.startsWith(e)))return e.label}return``}var te=JSON.parse(`{
  "schema": "harperz9-systems/v4",
  "domains": [
    {
      "id": "agent-systems",
      "label": "Agent systems",
      "summary": "Model routing, agent execution, and durable workflow state."
    },
    {
      "id": "evaluation-verification",
      "label": "Evaluation and verification",
      "summary": "Tests, receipts, provenance, and evidence-bounded conclusions."
    },
    {
      "id": "security-privacy",
      "label": "Security and privacy",
      "summary": "Authorized security engineering and privacy-preserving controls."
    },
    {
      "id": "developer-infrastructure",
      "label": "Developer infrastructure",
      "summary": "Tools that make building, integrating, and releasing systems more reliable."
    },
    {
      "id": "graphics-media",
      "label": "Graphics and media",
      "summary": "Rendering, color, audio, image, and generative production systems."
    },
    {
      "id": "research-education",
      "label": "Research and education",
      "summary": "Research intake, learning systems, publications, and teaching surfaces."
    }
  ],
  "relationshipPolicy": {
    "relatedUsage": "navigation-only",
    "integrationClaims": "relations-only",
    "hierarchyClaims": "prohibited-without-explicit-verified-relation"
  },
  "relations": [
    {
      "source": "flywheel",
      "target": "gather",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-gather-lane-code",
        "flywheel-release-v0-3-10",
        "gather-release-v1-6-1"
      ],
      "claimScope": "Flywheel declares and launches Gather as its research-intake MCP lane. This does not make Gather a Flywheel-owned product."
    },
    {
      "source": "flywheel",
      "target": "crucible",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-crucible-lane-code",
        "flywheel-release-v0-3-10",
        "crucible-release-v1-2-0"
      ],
      "claimScope": "Flywheel declares and launches Crucible as its verification MCP lane. This does not make Crucible a Flywheel-owned product."
    },
    {
      "source": "flywheel",
      "target": "index",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-index-lane-code",
        "flywheel-release-v0-3-10",
        "index-release-v2-10-0"
      ],
      "claimScope": "Flywheel declares and launches Index as its workspace-structure MCP lane. The Flywheel lane metadata currently trails the published Index 2.10.0 package."
    },
    {
      "source": "flywheel",
      "target": "forum",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-forum-lane-code",
        "flywheel-release-v0-3-10",
        "forum-release-v1-13-0"
      ],
      "claimScope": "Flywheel declares and launches Forum as its orchestration MCP lane."
    },
    {
      "source": "flywheel",
      "target": "learn",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-learn-lane-code",
        "flywheel-release-v0-3-10",
        "learn-public-source"
      ],
      "claimScope": "Flywheel declares Learn 1.6.0 as a Node MCP lane. Learn remains an independently published package."
    },
    {
      "source": "flywheel",
      "target": "telos",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-telos-lane-code",
        "flywheel-release-v0-3-10",
        "telos-public-source"
      ],
      "claimScope": "Flywheel declares and launches the Telos MCP workbench as a lane."
    },
    {
      "source": "flywheel",
      "target": "relay",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-relay-lane-code",
        "flywheel-release-v0-3-10",
        "relay-public-source"
      ],
      "claimScope": "Flywheel declares and launches Relay as its coding-agent MCP lane."
    },
    {
      "source": "flywheel",
      "target": "plexus",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-plexus-lane-code",
        "flywheel-release-v0-3-10",
        "plexus-public-source"
      ],
      "claimScope": "Flywheel declares and launches Plexus as its capability-mesh and tool-wiring MCP lane. Plexus can probe registered lanes when explicitly requested, but declared mesh edges are not semantic interoperability proof."
    },
    {
      "source": "flywheel",
      "target": "mneme",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-mneme-lane-code",
        "flywheel-release-v0-3-10",
        "mneme-public-source"
      ],
      "claimScope": "Flywheel declares and launches Mneme as its memory MCP lane. Flywheel lane metadata currently trails Mneme source version 0.2.0."
    },
    {
      "source": "flywheel",
      "target": "accountable-surface",
      "relation": "integrates-lane",
      "status": "verified-in-source",
      "evidenceIds": [
        "flywheel-accountable-surface-lane-code",
        "flywheel-release-v0-3-10",
        "accountable-surface-public-source"
      ],
      "claimScope": "Flywheel declares Accountable Surface as an actuation lane with additional Coherence Membrane and Proof Surface source roots."
    },
    {
      "source": "truth-enb",
      "target": "enb-runtime-core",
      "relation": "build-dependency",
      "status": "verified-in-source",
      "evidenceIds": [
        "truth-enb-runtime-core-link-code",
        "truth-enb-source-1-0-0",
        "enb-runtime-core-public-source-0-1-0"
      ],
      "claimScope": "Truth ENB pins ENB Runtime Core for its native runtime build."
    },
    {
      "source": "truth-enb",
      "target": "skyrimbridge",
      "relation": "optional-runtime-integration",
      "status": "verified-in-source",
      "evidenceIds": [
        "truth-enb-skyrimbridge-code",
        "truth-enb-source-1-0-0",
        "skyrimbridge-public-source-3-0-0"
      ],
      "claimScope": "SkyrimBridge is optional for the base optical suite and supplies celestial data used by the current procedural sky path."
    },
    {
      "source": "elder-enb",
      "target": "enb-runtime-core",
      "relation": "optional-native-runtime-dependency",
      "status": "verified-in-source",
      "evidenceIds": [
        "elder-enb-runtime-core-link-code",
        "elder-enb-public-source-0-1-0",
        "enb-runtime-core-public-source-0-1-0"
      ],
      "claimScope": "Elder ENB's optional native runtime links ENB Runtime Core."
    },
    {
      "source": "elder-enb",
      "target": "skyrimbridge",
      "relation": "optional-runtime-integration",
      "status": "verified-in-source",
      "evidenceIds": [
        "elder-enb-skyrimbridge-code",
        "elder-enb-public-source-0-1-0",
        "skyrimbridge-public-source-3-0-0"
      ],
      "claimScope": "Elder ENB exposes optional SkyrimBridge interoperability. This does not make either project a dependency of the other."
    },
    {
      "source": "engine-revival",
      "target": "brender-archival",
      "relation": "accepts-evidence-from",
      "status": "verified-in-source",
      "evidenceIds": [
        "engine-revival-brender-evidence-code",
        "engine-revival-release-v0-1-0",
        "brender-archival-release-v0-1-1"
      ],
      "claimScope": "Engine Revival can import BRender Archival evidence; neither project is a runtime dependency of the other."
    },
    {
      "source": "studio-engine",
      "target": "raw",
      "relation": "optional-native-render-bridge",
      "status": "verified-in-source",
      "evidenceIds": [
        "studio-engine-raw-bridge-code",
        "studio-engine-public-source",
        "raw-public-source-1-0-0"
      ],
      "claimScope": "Studio Engine can locate and invoke the optional RAW native CLI bridge; its Python core remains usable without RAW."
    },
    {
      "source": "chorus",
      "target": "gather",
      "relation": "accepts-corpus-from",
      "status": "verified-in-source",
      "evidenceIds": [
        "chorus-gather-corpus-code",
        "chorus-public-source-0-1-0",
        "gather-release-v1-6-1"
      ],
      "claimScope": "Chorus accepts Gather-compatible corpus directories or JSON comment rows. It is not a declared Flywheel lane in the current lane registry."
    }
  ],
  "systems": [
    {
      "id": "flywheel",
      "name": "Flywheel",
      "purpose": "Flywheel sends a task to a selected local or hosted AI model, gives that model approved tools, checks the resulting work, and returns a journal and receipt that can be reviewed or replayed.",
      "useCases": [
        "agent workflow orchestration",
        "model-neutral execution",
        "receipt-backed evaluation"
      ],
      "href": "flywheel.html",
      "sourceHref": "https://github.com/HarperZ9/flywheel",
      "domains": [
        "agent-systems",
        "evaluation-verification",
        "developer-infrastructure"
      ],
      "family": "platform",
      "architectureRole": "primary-platform",
      "audiences": [
        "agent-system engineers",
        "evaluation engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "review and CI lanes",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install flywheel-verify; flywheel up",
      "verificationCommand": "flywheel lanes --probe",
      "evidence": [
        {
          "id": "flywheel-release-v0-3-10",
          "type": "release",
          "label": "Flywheel v0.3.10",
          "href": "https://github.com/HarperZ9/flywheel/releases/tag/v0.3.10",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v0.3.10 public release and main default branch were verified."
        },
        {
          "id": "flywheel-gather-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Gather lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L55-L58",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Gather's package, command, MCP arguments, version, source repository, and role."
        },
        {
          "id": "flywheel-crucible-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Crucible lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L59-L62",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Crucible's package, command, MCP arguments, version, source repository, and role."
        },
        {
          "id": "flywheel-index-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Index lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L63-L66",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Index's package, command, MCP arguments, source repository, and role; its version field is visibly stale against the published package."
        },
        {
          "id": "flywheel-forum-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Forum lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L67-L70",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Forum's package, command, MCP arguments, version, source repository, and role."
        },
        {
          "id": "flywheel-learn-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Learn lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L71-L74",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Learn's npm package, Node MCP entry, version, source repository, and role."
        },
        {
          "id": "flywheel-telos-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Telos lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L75-L78",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Telos's npm package, MCP entry, version, source repository, and role."
        },
        {
          "id": "flywheel-relay-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Relay lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L83-L86",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Relay's package, command, MCP arguments, source repository, and role."
        },
        {
          "id": "flywheel-plexus-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Plexus lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L87-L90",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Plexus's package, command, MCP arguments, source repository, and role."
        },
        {
          "id": "flywheel-mneme-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Mneme lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L91-L94",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Mneme's package, command, MCP arguments, source repository, and role; its version field is visibly stale against source."
        },
        {
          "id": "flywheel-accountable-surface-lane-code",
          "type": "code-permalink",
          "label": "Flywheel Accountable Surface lane declaration",
          "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L100-L107",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned lane registry declares Accountable Surface's server entry, source repository, extra source roots, and actuation role."
        }
      ],
      "limitations": [
        "Receipts establish witnessed actions and checks, not general model correctness.",
        "Local weights and optional signing or monitoring features have separate installation requirements."
      ],
      "boundary": "Use model routes, tools, data, and environments only with the authority required by their owners and providers.",
      "inputs": [
        "task and acceptance criteria",
        "model and endpoint profiles",
        "tool manifests and permission grants",
        "workspace evidence"
      ],
      "outputs": [
        "agent run results",
        "witnessed tool and model events",
        "verification receipts",
        "replayable run artifacts"
      ],
      "dependencies": [],
      "related": [
        "telos",
        "index",
        "gather",
        "forum",
        "crucible",
        "learn",
        "relay",
        "plexus",
        "mneme",
        "chorus"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "agent-systems",
      "productType": "verified-inference platform and desktop client",
      "releaseState": "stable v0.3.10"
    },
    {
      "id": "telos",
      "name": "Telos",
      "purpose": "Telos is a local Node CLI and MCP server that connects a workstation to research, creative, model-foundry, native-control, and proof tools. It accepts CLI or MCP requests plus local manifests, fixtures, and workspace state, then returns structured tool results, readiness diagnostics, hashes, proof packets, and replayable action records.",
      "useCases": [
        "shared human-model workspaces",
        "MCP tool execution",
        "replayable creative sessions"
      ],
      "href": "systems/telos.html",
      "sourceHref": "https://github.com/HarperZ9/telos",
      "domains": [
        "agent-systems",
        "developer-infrastructure",
        "graphics-media"
      ],
      "family": "infrastructure",
      "architectureRole": "shared-workbench",
      "audiences": [
        "agent-system engineers",
        "software engineers",
        "graphics engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "local development workspaces",
        "creative production pipelines"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "run",
      "entryCommand": "node demo/run.mjs",
      "verificationCommand": "npm run test:mcp",
      "evidence": [
        {
          "id": "telos-public-source",
          "type": "source",
          "label": "Telos public source",
          "href": "https://github.com/HarperZ9/telos",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The package metadata identifies Telos 0.2.0, the latest GitHub tag found was v0.1.0, and the README describes a local MCP workbench with native tools, proof lanes, research packets, model foundry, and replayable sessions."
        }
      ],
      "limitations": [
        "Pre-1.0 interfaces may change.",
        "A research packet does not by itself prove causal discovery, robot safety, or hardware fault-tolerance claims."
      ],
      "boundary": "Workstation actions and external effects remain subject to explicit operator authority and tool-specific gates.",
      "inputs": [
        "MCP requests",
        "workspace paths and task material",
        "native-control grants",
        "creative or research specifications"
      ],
      "outputs": [
        "tool results",
        "proof packets",
        "measured creative artifacts",
        "replayable session records"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "gather",
        "index",
        "forum",
        "crucible",
        "studio-engine"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "developer-infrastructure",
      "productType": "local MCP workbench",
      "releaseState": "active source 0.2.0; latest tag v0.1.0"
    },
    {
      "id": "index",
      "name": "Index",
      "purpose": "Derive offline repository wikis, dependency and symbol graphs, workspace atlases, context envelopes, architecture checks, and freshness evidence from file-and-line-grounded source.",
      "useCases": [
        "multi-repository mapping",
        "dependency analysis",
        "offline architecture documentation"
      ],
      "href": "index-graph.html",
      "sourceHref": "https://github.com/HarperZ9/index",
      "domains": [
        "developer-infrastructure",
        "evaluation-verification"
      ],
      "family": "infrastructure",
      "architectureRole": "workspace-map-and-context-layer",
      "audiences": [
        "software engineers",
        "evaluation engineers"
      ],
      "deploymentContexts": [
        "local development workspaces",
        "review and CI lanes"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install index-graph; index wiki --root <repo-path> --out wiki.html",
      "verificationCommand": "index wiki --verify wiki.html --root <repo-path>",
      "evidence": [
        {
          "id": "index-release-v2-10-0",
          "type": "release",
          "label": "Index 2.10.0 on PyPI",
          "href": "https://pypi.org/project/index-graph/2.10.0/",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The package index and source metadata both report index-graph 2.10.0; the local installed copy remains 2.9.0."
        }
      ],
      "limitations": [
        "Dynamic imports and unsupported structures can remain incomplete or unverifiable.",
        "Structural evidence does not guarantee the accuracy of explanatory prose."
      ],
      "boundary": "Inspect only repositories and workspaces you are authorized to read.",
      "inputs": [
        "repository or workspace roots",
        "include and exclude rules",
        "mapping and verification options"
      ],
      "outputs": [
        "offline wikis and atlases",
        "dependency and symbol graphs",
        "context envelopes",
        "freshness and drift findings"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "forum",
        "gather",
        "telos"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "developer-infrastructure",
      "productType": "workspace map and context system",
      "releaseState": "beta 2.10.0 in source and PyPI"
    },
    {
      "id": "gather",
      "name": "Gather",
      "purpose": "Extract and crawl difficult research sources, including JavaScript-rendered pages, authenticated APIs, scholarly records, PDFs, OCR, audio, video, feeds, and local documents; store content-addressed corpora and attach re-checkable provenance to every item.",
      "useCases": [
        "structured extraction, crawling, and change tracking",
        "scholarly and hard-source research intake",
        "corpus verification and pilot evidence bundles"
      ],
      "href": "gather.html",
      "sourceHref": "https://github.com/HarperZ9/gather",
      "domains": [
        "research-education",
        "developer-infrastructure"
      ],
      "family": "research-education",
      "architectureRole": "research-intake-layer",
      "audiences": [
        "researchers and educators",
        "software engineers"
      ],
      "deploymentContexts": [
        "research and learning environments",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install gather-engine; gather extract https://example.com/article",
      "verificationCommand": "gather corpus verify ./corpus",
      "evidence": [
        {
          "id": "gather-release-v1-6-1",
          "type": "release",
          "label": "Gather v1.6.1",
          "href": "https://github.com/HarperZ9/gather/releases/tag/v1.6.1",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v1.6.1 public release was verified."
        }
      ],
      "limitations": [
        "Static web mode does not execute JavaScript.",
        "Optional hard-source adapters require external tools, and untrusted URLs near internal services require separate network controls."
      ],
      "boundary": "Respect access controls, copyright, privacy, and the terms governing each source.",
      "inputs": [
        "URLs and API endpoints",
        "local files and directories",
        "source manifests",
        "adapter configuration"
      ],
      "outputs": [
        "extracted Markdown and structured blocks",
        "receipted corpus items",
        "content-addressed corpora",
        "witnessed digests and bundles"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "crucible",
        "learn",
        "chorus"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "research-education",
      "productType": "research intake and corpus system",
      "releaseState": "stable v1.6.1"
    },
    {
      "id": "forum",
      "name": "Forum",
      "purpose": "Route, plan, and execute multi-agent dependency waves across model-neutral backends with budgets, approval gates, crash-safe checkpoints, delivery contracts, service surfaces, and a replayable causal ledger.",
      "useCases": [
        "multi-agent orchestration",
        "dependency-aware planning",
        "reviewable handoffs"
      ],
      "href": "forum.html",
      "sourceHref": "https://github.com/HarperZ9/forum",
      "domains": [
        "agent-systems",
        "developer-infrastructure",
        "evaluation-verification"
      ],
      "family": "infrastructure",
      "architectureRole": "multi-agent-orchestration-engine",
      "audiences": [
        "agent-system engineers",
        "software engineers",
        "evaluation engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "local development workspaces",
        "review and CI lanes"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install forum-engine; forum route \\"build the requested system\\"",
      "verificationCommand": "forum ledger verify",
      "evidence": [
        {
          "id": "forum-release-v1-13-0",
          "type": "release",
          "label": "Forum v1.13.0",
          "href": "https://github.com/HarperZ9/forum/releases/tag/v1.13.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v1.13.0 public release was verified."
        }
      ],
      "limitations": [
        "A valid ledger proves recorded integrity and replayability, not that model output is substantively correct.",
        "Executors and human approval policy remain operator-supplied."
      ],
      "boundary": "Agent permissions must remain no broader than the operator's authority and the active task scope.",
      "inputs": [
        "task graphs and delivery contracts",
        "agent and executor profiles",
        "budgets and approval policy",
        "checkpoint state"
      ],
      "outputs": [
        "dependency-ordered agent runs",
        "handoff artifacts",
        "crash-safe checkpoints",
        "causal ledger entries"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "relay",
        "plexus",
        "mneme"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "agent-systems",
      "productType": "multi-agent orchestration engine",
      "releaseState": "stable v1.13.0"
    },
    {
      "id": "crucible",
      "name": "Crucible",
      "purpose": "Register a thesis as falsifiable claims, steelman the tests, measure each claim against replayable oracles, refine the weakest axis, and emit re-checkable MATCH, DRIFT, or UNVERIFIABLE verdicts.",
      "useCases": [
        "thesis and falsification evaluation",
        "cleanroom verifier handoff",
        "verdict-regression CI and oracle replay"
      ],
      "href": "crucible.html",
      "sourceHref": "https://github.com/HarperZ9/crucible",
      "domains": [
        "evaluation-verification",
        "research-education"
      ],
      "family": "verification",
      "architectureRole": "measured-judgment-layer",
      "audiences": [
        "evaluation engineers",
        "researchers and educators"
      ],
      "deploymentContexts": [
        "review and CI lanes",
        "research and learning environments"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install crucible-bench; python examples/demo.py",
      "verificationCommand": "python -m pytest",
      "evidence": [
        {
          "id": "crucible-release-v1-2-0",
          "type": "release",
          "label": "Crucible v1.2.0",
          "href": "https://github.com/HarperZ9/crucible/releases/tag/v1.2.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v1.2.0 public release was verified."
        }
      ],
      "limitations": [
        "Verdict quality cannot exceed the supplied substrate, measurement, tolerance, and criterion.",
        "Missing or ill-posed evidence fails closed."
      ],
      "boundary": "Do not present a verdict as stronger than the evidence and criterion that produced it.",
      "inputs": [
        "thesis and claim specifications",
        "measurements and tolerances",
        "replay descriptors",
        "verifier artifacts"
      ],
      "outputs": [
        "per-claim verdicts",
        "witnessed assessments",
        "cleanroom review bundles",
        "CI verdict matrices"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "gather",
        "index",
        "telos",
        "learn"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "evaluation-verification",
      "productType": "falsifiable claim evaluation system",
      "releaseState": "stable v1.2.0"
    },
    {
      "id": "emet",
      "name": "EMET",
      "purpose": "Verify whether bytes reaching a model, reviewer, or pipeline still match their claimed source; anchor, compare, neutralize embedded authority, audit drift, and mint portable closed-verdict receipts across four implementations.",
      "useCases": [
        "byte-integrity verification",
        "proof-packet witnessing",
        "cross-implementation conformance"
      ],
      "href": "emet.html",
      "sourceHref": "https://github.com/HarperZ9/emet",
      "domains": [
        "evaluation-verification",
        "security-privacy",
        "developer-infrastructure"
      ],
      "family": "verification",
      "architectureRole": "independent-integrity-witness",
      "audiences": [
        "evaluation engineers",
        "authorized security teams",
        "software engineers"
      ],
      "deploymentContexts": [
        "review and CI lanes",
        "owned or expressly authorized systems",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install emet",
      "verificationCommand": "emet selftest; emet check receipt.json",
      "evidence": [
        {
          "id": "emet-release-v1-2-0",
          "type": "release",
          "label": "EMET v1.2.0",
          "href": "https://github.com/HarperZ9/emet/releases/tag/v1.2.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v1.2.0 public release was verified."
        }
      ],
      "limitations": [
        "The witness reports byte agreement, drift, or inability to verify; it does not judge semantic quality.",
        "Same-author conformance implementations prove rule clarity, not independent authorship."
      ],
      "boundary": "Run on files and packets you are authorized to inspect.",
      "inputs": [
        "source and observed byte streams",
        "anchor and comparison policy",
        "portable receipt envelopes"
      ],
      "outputs": [
        "MATCH, DRIFT, or UNVERIFIABLE integrity verdicts",
        "portable witness receipts",
        "cross-implementation conformance results"
      ],
      "dependencies": [],
      "related": [
        "crucible",
        "repo-proof-index",
        "accountable-surface"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "evaluation-verification",
      "productType": "cross-implementation integrity witness",
      "releaseState": "stable v1.2.0"
    },
    {
      "id": "buildlang",
      "name": "BuildLang",
      "purpose": "Compile a systems language with typed capability effects, sum and linear types, a production C backend, two-way C FFI, shader output, CLI and LSP tooling, and re-checkable build receipts.",
      "useCases": [
        "capability-aware systems programming",
        "native C-path compilation",
        "shader generation"
      ],
      "href": "buildlang.html",
      "sourceHref": "https://github.com/HarperZ9/buildlang",
      "domains": [
        "developer-infrastructure",
        "graphics-media"
      ],
      "family": "infrastructure",
      "architectureRole": "compiler-toolchain",
      "audiences": [
        "software engineers",
        "graphics engineers"
      ],
      "deploymentContexts": [
        "local development workspaces",
        "creative production pipelines"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "cargo install buildlang; buildc run examples/quickstart/hello.bld",
      "verificationCommand": "buildc corpus verify",
      "evidence": [
        {
          "id": "buildlang-release-v1-2-0",
          "type": "release",
          "label": "BuildLang v1.2.0",
          "href": "https://github.com/HarperZ9/buildlang/releases/tag/v1.2.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v1.2.0 public release was verified."
        }
      ],
      "limitations": [
        "C is the production backend.",
        "SPIR-V, LLVM, WebAssembly, Rust, native-object backends, GPU compute, and linear types retain experimental scope."
      ],
      "boundary": "Generated programs inherit the authority and safety obligations of the capabilities they exercise.",
      "inputs": [
        "BuildLang source",
        "capability declarations",
        "C FFI bindings",
        "compiler and target options"
      ],
      "outputs": [
        "C and native binaries",
        "HLSL and GLSL shaders",
        "diagnostics and LSP responses",
        "build receipts"
      ],
      "dependencies": [],
      "related": [
        "studio-engine",
        "build-color",
        "raw"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "developer-infrastructure",
      "productType": "systems language and compiler toolchain",
      "releaseState": "stable v1.2.0; non-C backends experimental"
    },
    {
      "id": "learn",
      "name": "Learn",
      "purpose": "Plan and re-check learner-authored study sessions from declared objectives and recorded attempts, using spaced review, retrieval prompts, prerequisite gating, misconception tracking, prediction, and self-explanation; separately run course logistics while halting at graded work.",
      "useCases": [
        "study planning and retrieval practice",
        "practice-ledger and mastery re-verification",
        "course logistics with hard human handoffs"
      ],
      "href": "learn.html",
      "sourceHref": "https://github.com/HarperZ9/learn",
      "domains": [
        "research-education",
        "agent-systems"
      ],
      "family": "research-education",
      "architectureRole": "learning-and-coursework-system",
      "audiences": [
        "researchers and educators",
        "agent-system engineers"
      ],
      "deploymentContexts": [
        "research and learning environments",
        "controlled agent workflows"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "npm install -g @harperz9/learn; learn tutor plan mysession --topic algebra --objectives solve-equations",
      "verificationCommand": "node --test",
      "evidence": [
        {
          "id": "learn-public-source",
          "type": "source",
          "label": "Learn public source",
          "href": "https://github.com/HarperZ9/learn",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The public repository identifies Learn 1.6.0 package source; no GitHub release is claimed."
        }
      ],
      "limitations": [
        "Automation halts at graded, consent, CAPTCHA, payment, and account-creation steps.",
        "Mastery derives only from the learner's witnessed attempts."
      ],
      "boundary": "The learner remains responsible for graded answers, consent, identity, and institutional rules.",
      "inputs": [
        "topics and declared learning objectives",
        "learner-supplied attempts and feedback",
        "course workflow JSON",
        "proof packets"
      ],
      "outputs": [
        "study plans and due-review schedules",
        "misconception and readiness results",
        "tutor receipts",
        "course-logistics and human-assessment handoff records"
      ],
      "dependencies": [],
      "related": [
        "gather",
        "crucible",
        "flywheel"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "research-education",
      "productType": "learning and coursework system",
      "releaseState": "published npm 1.6.0; no GitHub release"
    },
    {
      "id": "relay",
      "name": "Relay",
      "purpose": "Run a permission-gated coding agent across local models, subscription CLIs, APIs, gateways, and cloud endpoints, with failover, acceptance checks, resumable sessions, MCP access, and a hash-chained trajectory.",
      "useCases": [
        "model-neutral coding workflows",
        "provider failover",
        "reviewable tool execution"
      ],
      "href": "systems/relay.html",
      "sourceHref": "https://github.com/HarperZ9/relay",
      "domains": [
        "agent-systems",
        "developer-infrastructure"
      ],
      "family": "infrastructure",
      "architectureRole": "coding-agent-and-execution-lane",
      "audiences": [
        "agent-system engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install git+https://github.com/HarperZ9/relay.git; relay --health --online",
      "verificationCommand": "python -m pytest -q",
      "evidence": [
        {
          "id": "relay-public-source",
          "type": "source",
          "label": "Relay public source",
          "href": "https://github.com/HarperZ9/relay",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public source metadata identifies relay-agent 0.1.0, and the README describes a permission-checked tool loop, hash-chained ledger, MCP surface, failover routes, and acceptance checks; no GitHub release tag was returned."
        }
      ],
      "limitations": [
        "The command denylist is not a security boundary.",
        "A valid trajectory proves recorded actions, not that edits are correct; acceptance needs an operator-owned check."
      ],
      "boundary": "Tool use remains permission-checked and limited to authorized repositories, systems, and endpoints.",
      "inputs": [
        "coding tasks and acceptance checks",
        "repository context",
        "endpoint profiles",
        "tool grants"
      ],
      "outputs": [
        "proposed and applied code changes",
        "acceptance-check results",
        "resumable session state",
        "hash-chained trajectories"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "forum",
        "plexus",
        "mneme"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "agent-systems",
      "productType": "permission-gated coding agent and execution lane",
      "releaseState": "active source 0.1.0; no GitHub release"
    },
    {
      "id": "plexus",
      "name": "Plexus",
      "purpose": "Read declared interop manifests, derive producer-consumer wiring and dependency plans, emit inspectable graphs and pipeline scripts, expose the mesh over MCP, and explicitly probe registered Flywheel lanes when requested.",
      "useCases": [
        "tool discovery",
        "capability matching",
        "inspectable pipeline planning"
      ],
      "href": "systems/plexus.html",
      "sourceHref": "https://github.com/HarperZ9/plexus",
      "domains": [
        "agent-systems",
        "developer-infrastructure"
      ],
      "family": "infrastructure",
      "architectureRole": "capability-mesh-wiring-infrastructure",
      "audiences": [
        "agent-system engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install git+https://github.com/HarperZ9/plexus.git; plexus discover --builtin",
      "verificationCommand": "plexus plan --goal crucible --builtin > plan.json; plexus verify --plan plan.json --builtin",
      "evidence": [
        {
          "id": "plexus-public-source",
          "type": "source",
          "label": "Plexus public source",
          "href": "https://github.com/HarperZ9/plexus",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public source metadata identifies plexus-mesh 0.2.0, and the README describes manifest discovery, wiring plans, route scripts, graphs, MCP exposure, and explicit lane probe commands; no GitHub release tag was returned."
        }
      ],
      "limitations": [
        "Manifest edges and source pointers remain declared claims until followed or probed.",
        "Probe mode checks registered lane reachability, not semantic interoperability or output quality."
      ],
      "boundary": "A wiring plan does not grant authority to execute any connected capability.",
      "inputs": [
        "tool and lane manifests",
        "desired inputs and outputs",
        "pipeline constraints"
      ],
      "outputs": [
        "capability graphs",
        "producer-consumer wiring plans",
        "runnable pipeline scripts",
        "lane health results"
      ],
      "dependencies": [],
      "related": [
        "relay",
        "forum",
        "flywheel"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "developer-infrastructure",
      "productType": "capability mesh and toolchain wiring infrastructure",
      "releaseState": "active source 0.2.0; no GitHub release"
    },
    {
      "id": "mneme",
      "name": "Mneme",
      "purpose": "Mneme is a zero-dependency SQLite memory store with CLI and MCP access for agent conversations and extracted facts. It stores session turns or imported source items, answers retrieval queries with deterministic BM25, vector, and recency ranking, and returns provenance, recall receipts, drift verdicts, replayable history views, and audited update or forgetting records.",
      "useCases": [
        "agent memory",
        "provenance-bearing recall",
        "memory drift review"
      ],
      "href": "systems/mneme.html",
      "sourceHref": "https://github.com/HarperZ9/mneme",
      "domains": [
        "agent-systems",
        "evaluation-verification"
      ],
      "family": "verification",
      "architectureRole": "agent-memory-subsystem",
      "audiences": [
        "agent-system engineers",
        "evaluation engineers"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "review and CI lanes"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install git+https://github.com/HarperZ9/mneme.git; mneme recall \\"where does the user live\\" --json",
      "verificationCommand": "mneme drift; python -m pytest -q",
      "evidence": [
        {
          "id": "mneme-public-source",
          "type": "source",
          "label": "Mneme public source",
          "href": "https://github.com/HarperZ9/mneme",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public source metadata identifies mneme-memory 0.2.0, the latest GitHub tag found was v0.1.0, and the README covers provenance, recall, drift detection, replay, forgetting, and MCP access."
        }
      ],
      "limitations": [
        "Source recheck remains Mneme-owned rather than independently re-read by Crucible.",
        "Replay rejects ambiguous SQLite sidecar or hardlink state."
      ],
      "boundary": "Store and recall only information the operator is authorized to retain and process.",
      "inputs": [
        "memory records and provenance",
        "retrieval queries and filters",
        "source snapshots",
        "forgetting policy"
      ],
      "outputs": [
        "ranked memory recall",
        "provenance and drift findings",
        "temporal and user-scoped memory views",
        "audited forgetting receipts"
      ],
      "dependencies": [],
      "related": [
        "relay",
        "forum",
        "flywheel"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "agent-systems",
      "productType": "deterministic agent memory subsystem",
      "releaseState": "active source 0.2.0; latest tag v0.1.0"
    },
    {
      "id": "studio-engine",
      "name": "Studio Engine",
      "purpose": "Generate, critique, refine, and preserve replayable creative worlds from one expression algebra that emits shader programs, audio graphs, motion timelines, previews, measurements, and receipts.",
      "useCases": [
        "seeded world generation",
        "shader and sound authoring",
        "replayable creative production"
      ],
      "href": "systems/studio-engine.html",
      "sourceHref": "https://github.com/HarperZ9/studio-engine",
      "domains": [
        "graphics-media",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "creative-simulation-and-render-engine",
      "audiences": [
        "graphics engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "creative production pipelines",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "run",
      "entryCommand": "python -m studio_engine 7 gyroid",
      "verificationCommand": "python -m unittest discover -s tests",
      "evidence": [
        {
          "id": "studio-engine-public-source",
          "type": "source",
          "label": "Studio Engine public source",
          "href": "https://github.com/HarperZ9/studio-engine",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The public main branch identifies Studio Engine 0.2.0; no GitHub release is claimed."
        },
        {
          "id": "studio-engine-raw-bridge-code",
          "type": "code-permalink",
          "label": "Studio Engine optional RAW CLI bridge",
          "href": "https://github.com/HarperZ9/studio-engine/blob/4dc706555258eeb8a80841ae4f0b2482dabe6f89/studio_engine/native_render.py#L1-L28",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned Python module defines RAW's native CLI as a separately built optional renderer and records honest absence when it is unavailable."
        }
      ],
      "limitations": [
        "Studio Engine is not presented as a finished product.",
        "Browsers, GPUs, and audio hosts realize its programs; the native renderer is optional and APIs may move before 1.0."
      ],
      "boundary": "Generated media must respect the rights, licenses, and consent attached to its inputs and intended use.",
      "inputs": [
        "seed and generator expression",
        "render, sound, and motion parameters",
        "critique and refinement constraints"
      ],
      "outputs": [
        "WebGL shader programs",
        "WebAudio graphs",
        "motion timelines",
        "deterministic frames and receipts"
      ],
      "dependencies": [],
      "related": [
        "build-color",
        "buildlang",
        "raw",
        "retro-engine"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "graphics-media",
      "productType": "procedural audiovisual engine",
      "releaseState": "active pre-1.0 source 0.2.0; no release"
    },
    {
      "id": "build-color",
      "name": "Build Color",
      "purpose": "Measure, convert, compare, and transform digital color across perceptual spaces, HDR tone maps, appearance models, chromatic adaptation, spectral utilities, gamut mapping, ICC profiles, LUTs, and an optional GUI.",
      "useCases": [
        "color measurement",
        "HDR tone mapping",
        "ICC and LUT generation"
      ],
      "href": "build-color.html",
      "sourceHref": "https://github.com/HarperZ9/build-color",
      "domains": [
        "graphics-media"
      ],
      "family": "graphics-retro",
      "architectureRole": "color-science-workbench",
      "audiences": [
        "graphics engineers"
      ],
      "deploymentContexts": [
        "creative production pipelines"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "pip install .; build-color info ff6030",
      "verificationCommand": "pytest tests/ -q --cov=build_color --cov-report=term-missing --cov-fail-under=45",
      "evidence": [
        {
          "id": "build-color-release-v1-0-1",
          "type": "release",
          "label": "Build Color v1.0.1",
          "href": "https://github.com/HarperZ9/build-color/releases/tag/v1.0.1",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The latest public release is v1.0.1; newer 1.0.2 source metadata remains beta."
        }
      ],
      "limitations": [
        "The workbench measures digital color behavior; it is not a physical display instrument.",
        "The GUI and fuller numerical stack require optional dependencies."
      ],
      "boundary": "Do not represent software output as physical-instrument evidence without an actual calibrated instrument.",
      "inputs": [
        "color values and color-space metadata",
        "spectral or viewing-condition data",
        "HDR and gamut policy",
        "ICC and LUT parameters"
      ],
      "outputs": [
        "converted and compared colors",
        "tone-mapped and gamut-mapped values",
        "ICC profiles and LUTs",
        "workbench visualizations"
      ],
      "dependencies": [
        "numpy"
      ],
      "related": [
        "studio-engine",
        "telos",
        "buildlang",
        "retro-engine"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "graphics-media",
      "productType": "color-science library and workbench",
      "releaseState": "beta source 1.0.2; latest tag v1.0.1"
    },
    {
      "id": "retro-engine",
      "name": "Retro Engine",
      "purpose": "Run an embedded browser studio that accepts images, drawing, GLSL, and audio traces; applies pixelation, hardware palettes, ordered dithering, early-3D shading, CRT processing, and stackable effects; then exports images, patches, MIDI, relief or disc data, and Loom handoffs.",
      "useCases": [
        "play",
        "browser pixel studio",
        "deterministic shader capture"
      ],
      "href": "retro.html",
      "sourceHref": "https://github.com/HarperZ9/HarperZ9.github.io/blob/main/system/retro-engine.js",
      "domains": [
        "graphics-media",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "embedded-browser-studio",
      "audiences": [
        "graphics engineers",
        "software engineers",
        "creative technologists"
      ],
      "deploymentContexts": [
        "creative production pipelines",
        "local development workspaces",
        "static browser surfaces"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "run",
      "entryCommand": "Open retro.html in a browser.",
      "verificationCommand": "npm run routes:check; npm run systems:check; npm run system-pages:check",
      "evidence": [
        {
          "id": "retro-engine-site-source",
          "type": "source",
          "label": "Retro Engine owned site source",
          "href": "https://github.com/HarperZ9/HarperZ9.github.io/blob/main/system/retro-engine.js",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The current public source includes browser runtime, studio wiring, and public page code for image, drawing, GLSL, audio, export, and Loom handoff flows; Retro output is explicitly separated from BRender restoration evidence."
        }
      ],
      "limitations": [
        "Retro Engine output is generic creative output and does not prove any BRender restoration fact.",
        "Browser, GPU, audio, and font rendering can differ by host, so captures are bounded media evidence rather than performance claims."
      ],
      "boundary": "Use only owned or licensed input media and do not present generated retro visuals as archival proof for another repository.",
      "inputs": [
        "local images and drawings",
        "GLSL source and preset parameters",
        "audio traces and optional MIDI input"
      ],
      "outputs": [
        "interactive WebGL and Canvas renders",
        "exported images and shader patches",
        "MIDI, relief, disc, and Loom handoff data"
      ],
      "dependencies": [
        "Browser Canvas, WebGL, and WebAudio APIs"
      ],
      "related": [
        "studio-engine",
        "build-color",
        "engine-revival",
        "brender-archival"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "embedded browser visual and audiovisual studio",
      "releaseState": "active public application; no package release"
    },
    {
      "id": "engine-revival",
      "name": "Engine Revival",
      "purpose": "Engine Revival stores and validates the public-safe metadata, target matrices, reproduction recipes, evidence packets, and reports needed to rebuild historical game engines, SDKs, rendering libraries, CGI toolkits, and studio technology.",
      "useCases": [
        "preserve",
        "repository evidence refresh",
        "restoration boundary review"
      ],
      "href": "engine-revival.html",
      "sourceHref": "https://github.com/HarperZ9/engine-revival",
      "domains": [
        "graphics-media",
        "evaluation-verification",
        "research-education",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "archival-and-revival-evidence-platform",
      "audiences": [
        "graphics engineers",
        "evaluation engineers",
        "researchers and educators",
        "software engineers"
      ],
      "deploymentContexts": [
        "review and CI lanes",
        "research and learning environments",
        "creative production pipelines"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install -e \\".[test]\\"; engine-revival seed; engine-revival validate",
      "verificationCommand": "engine-revival audit-public; python -m pytest",
      "evidence": [
        {
          "id": "engine-revival-release-v0-1-0",
          "type": "release",
          "label": "Engine Revival v0.1.0",
          "href": "https://github.com/HarperZ9/engine-revival/releases/tag/v0.1.0",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public source metadata identifies version 0.1.0, the latest GitHub tag found was v0.1.0, and the README frames Engine Revival as public-safe metadata, schema, validation, target-matrix, recipe, and evidence tooling."
        },
        {
          "id": "engine-revival-brender-evidence-code",
          "type": "code-permalink",
          "label": "Engine Revival BRender evidence import boundary",
          "href": "https://github.com/HarperZ9/engine-revival/blob/0af6d527860a63c418b5775dc0efe9ba89557604/scripts/regenerate_brender_publication_boundary.py#L111-L123",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The README states the BRender harness materializes an out-of-tree CMake scaffold and does not vendor upstream source or claim compile success until an external transcript is captured."
        }
      ],
      "limitations": [
        "Engine Revival local 12-target materializer scope is public metadata and scaffold; the verified external 21-target BRender boundary comes from BRender Archival v0.1.1 evidence.",
        "The page preserves evidence boundaries and does not claim product parity, adoption, performance, legal completeness, or vendored upstream source."
      ],
      "boundary": "Publish only repository metadata and restoration facts that have current first-party receipts, and keep imported AGPL-covered BRender media and receipts distinct from MIT repository code.",
      "inputs": [
        "public provenance and license records",
        "revival targets and reproduction recipes",
        "attempt and validation records",
        "imported BRender evidence"
      ],
      "outputs": [
        "validated preservation records",
        "target matrices and generated reports",
        "public-safe evidence packets",
        "materialized test harnesses"
      ],
      "dependencies": [],
      "related": [
        "brender-archival",
        "retro-engine"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "archival/revival evidence platform",
      "releaseState": "stable v0.1.0"
    },
    {
      "id": "brender-archival",
      "name": "BRender Archival",
      "purpose": "BRender Archival rebuilds Argonaut BRender from its public MIT source, runs the restored code through a 21-stage native test ladder, captures reproducible renders, and packages the source, provenance, and verification record for release.",
      "useCases": [
        "verify",
        "specific restoration evidence",
        "archival boundary review"
      ],
      "href": "brender-archival.html",
      "sourceHref": "https://github.com/HarperZ9/brender-archival",
      "domains": [
        "graphics-media",
        "evaluation-verification",
        "research-education",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "brender-revival-archive-and-harness",
      "audiences": [
        "graphics engineers",
        "evaluation engineers",
        "researchers and educators",
        "software engineers"
      ],
      "deploymentContexts": [
        "review and CI lanes",
        "research and learning environments",
        "creative production pipelines"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install -e \\".[test]\\"; python scripts/package_brender_release.py --source-root <BRender-v1.3.2> --output-root <release-stage>",
      "verificationCommand": "python -m pytest",
      "evidence": [
        {
          "id": "brender-archival-release-v0-1-1",
          "type": "release",
          "label": "BRender Archival v0.1.1",
          "href": "https://github.com/HarperZ9/brender-archival/releases/tag/v0.1.1",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The latest GitHub tag found was v0.1.1, and the public release evidence records a 21-of-21 CTest target transcript against the pinned public BRender source without vendoring proprietary source or assets."
        }
      ],
      "limitations": [
        "Specific BRender restoration proof must come from BRender evidence, not from Retro Engine screenshots or generic retro visuals.",
        "The release does not claim completed textured TIA output, x64 readiness, production readiness, adoption, endorsement, or vendored upstream source or assets."
      ],
      "boundary": "Keep BRender restoration evidence, Retro Engine play output, and Engine Revival preservation status distinct.",
      "inputs": [
        "pinned public BRender source checkout",
        "Visual Studio Win32 and CMake toolchain",
        "public-safe test assets and provenance records"
      ],
      "outputs": [
        "out-of-tree BRender builds",
        "21-target native verification results",
        "reproducible softrend and pentprim captures",
        "release and provenance packets"
      ],
      "dependencies": [],
      "related": [
        "engine-revival",
        "retro-engine"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "BRender restoration and build-test harness",
      "releaseState": "bounded milestone v0.1.1"
    },
    {
      "id": "proof-surface",
      "name": "Proof Surface",
      "purpose": "Proof Surface is a standard-library Python contract and validation library for authorization receipts, delegation chains, evidence packets, work records, witness receipts, and pre-execution gate requests. It validates structured JSON and returns schema issues plus advisory allow, deny, or needs-human decisions; it does not execute or enforce actions.",
      "useCases": [
        "authorization receipt review",
        "bounded agent actions",
        "evidence-bounded evaluation"
      ],
      "href": "proof-surface.html",
      "sourceHref": "https://github.com/HarperZ9/proof-surface",
      "domains": [
        "security-privacy",
        "evaluation-verification",
        "agent-systems"
      ],
      "family": "security",
      "architectureRole": "authorization-and-proof-contract-layer",
      "audiences": [
        "agent-system engineers",
        "evaluation engineers",
        "authorized security teams"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "review and CI lanes"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "inspect",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "proof-surface-public-source-0-2-0",
          "type": "source",
          "label": "Proof Surface public source 0.2.0",
          "href": "https://github.com/HarperZ9/proof-surface",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "Public source identifies version 0.2.0; no release claim is made."
        }
      ],
      "limitations": [
        "Proof Surface recommends authorization decisions; the surrounding system performs enforcement.",
        "Public source 0.2.0 does not establish independent adversarial review or production safety."
      ],
      "boundary": "Use only with explicit human authority; a recommendation does not itself grant permission.",
      "inputs": [
        "proposed agent actions",
        "authority and delegation grants",
        "scope and evidence contracts"
      ],
      "outputs": [
        "schema and contract validation findings",
        "effective delegated scope",
        "advisory allow, deny, or needs-human decisions"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "accountable-surface",
        "emet",
        "repo-proof-index"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "authorization and proof-packet library",
      "releaseState": "active source 0.2.0; no release"
    },
    {
      "id": "elder-enb",
      "name": "Elder ENB",
      "purpose": "Build an independently authored nine-stage ENBSeries 0.504 shader suite for Skyrim SE/AE, with five quality tiers, bounded cinematic effects, identity fallbacks, deterministic packaging, and an optional native frame-pulse runtime.",
      "useCases": [
        "ENB configuration review",
        "graphics runtime integration",
        "public build inspection"
      ],
      "href": "elder-enb.html",
      "sourceHref": "https://github.com/HarperZ9/elder-enb",
      "domains": [
        "graphics-media"
      ],
      "family": "graphics-retro",
      "architectureRole": "enb-shader-suite",
      "audiences": [
        "graphics engineers",
        "mod developers"
      ],
      "deploymentContexts": [
        "creative production pipelines",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "inspect",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "elder-enb-public-source-0-1-0",
          "type": "source",
          "label": "Elder ENB public source 0.1.0",
          "href": "https://github.com/HarperZ9/elder-enb",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "Public source identifies version 0.1.0 and latest tag v1.0.0-rc.5; no release claim is made."
        },
        {
          "id": "elder-enb-runtime-core-link-code",
          "type": "code-permalink",
          "label": "Elder ENB runtime-core build linkage",
          "href": "https://github.com/HarperZ9/elder-enb/blob/494f26b4e66fd9e79722d6b9e3a14cfb4afda9e0/native/runtime/CMakeLists.txt#L116-L134",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned public-main CMake source builds and links ENB Runtime Core into Elder's optional native runtime."
        },
        {
          "id": "elder-enb-skyrimbridge-code",
          "type": "code-permalink",
          "label": "Elder ENB optional SkyrimBridge bindings",
          "href": "https://github.com/HarperZ9/elder-enb/blob/494f26b4e66fd9e79722d6b9e3a14cfb4afda9e0/native/runtime/include/elder/runtime/RenderPayloadController.hpp#L15-L50",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned public-main header declares SkyrimBridge-named parameters and explicitly describes the source as optional."
        }
      ],
      "limitations": [
        "Final live ENB acceptance remains a limitation.",
        "The latest tag v1.0.0-rc.5 is not presented as a release."
      ],
      "boundary": "Use only with the game, runtime, and asset rights required by their owners.",
      "inputs": [
        "Skyrim SE/AE scene and ENBSeries data",
        "quality-tier configuration",
        "optional native frame-pulse state"
      ],
      "outputs": [
        "nine ENB shader stages",
        "five quality-tier configurations",
        "deterministic archives and shader verification results"
      ],
      "dependencies": [
        "Skyrim SE/AE",
        "ENBSeries 0.504"
      ],
      "related": [
        "enb-runtime-core",
        "skyrimbridge",
        "truth-enb"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "graphics-media",
      "productType": "ENB shader suite",
      "releaseState": "prerelease v1.0.0-rc.5"
    },
    {
      "id": "truth-enb",
      "name": "Truth ENB",
      "purpose": "Build a from-scratch ENBSeries 0.504 shader suite for Skyrim SE/AE, with a computed physical atmosphere and sky, raymarched clouds, an aurora curtain, exposure and tone mapping, five quality tiers, and an optional native camera bridge.",
      "useCases": [
        "installing a complete Skyrim SE/AE ENB preset",
        "running one authored look across five performance tiers",
        "developing and testing procedural sky, cloud, aurora, exposure, and tone-mapping shaders"
      ],
      "href": "truth-enb.html",
      "sourceHref": "https://github.com/HarperZ9/truth-enb",
      "domains": [
        "graphics-media"
      ],
      "family": "graphics-retro",
      "architectureRole": "enb-shader-suite",
      "audiences": [
        "Skyrim ENB users",
        "ENB preset and shader authors",
        "Skyrim mod developers"
      ],
      "deploymentContexts": [
        "Skyrim SE/AE with ENBSeries 0.504",
        "partial optical and post-processing use with Community Shaders and Effects 11",
        "local Windows shader and runtime development"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "inspect",
      "entryCommand": "cmake --preset vs2026-x64; cmake --build --preset vs2026-x64-debug",
      "verificationCommand": "ctest --preset vs2026-x64-debug --output-on-failure --no-tests=error",
      "evidence": [
        {
          "id": "truth-enb-source-1-0-0",
          "type": "source",
          "label": "Truth ENB 1.0.0 source",
          "href": "https://github.com/HarperZ9/truth-enb",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "CMake identifies project version 1.0.0. Current main is c2eaa9f, 32 commits after release-candidate tag v1.0.0-rc.1. Public upload remains blocked until the required live Skyrim SE/AE and ENB 0.504 acceptance runs are recorded."
        },
        {
          "id": "truth-enb-runtime-core-link-code",
          "type": "code-permalink",
          "label": "Truth ENB runtime-core build linkage",
          "href": "https://github.com/HarperZ9/truth-enb/blob/c2eaa9f51f78af0131cc475bc4438beb431cfbec/runtime/CMakeLists.txt#L115-L136",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned CMake source compiles and links ENB Runtime Core into the Truth runtime target."
        },
        {
          "id": "truth-enb-skyrimbridge-code",
          "type": "code-permalink",
          "label": "Truth ENB optional SkyrimBridge bindings",
          "href": "https://github.com/HarperZ9/truth-enb/blob/c2eaa9f51f78af0131cc475bc4438beb431cfbec/shaders/truth/TruthPrepassCore.fxh#L21-L24",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned shader source defines SkyrimBridge interoperability as an optional surface and preserves a safe path when its values are absent."
        }
      ],
      "limitations": [
        "Public upload remains blocked until the required live Skyrim SE/AE and ENB 0.504 acceptance matrix is recorded.",
        "The Community Shaders and Effects 11 path currently covers only partial optical and post-processing compatibility; world-space prepass composition remains disabled there.",
        "Generated promotional art is not gameplay evidence; visual-quality claims require labeled in-game captures."
      ],
      "boundary": "Truth does not bundle ENBSeries, Community Shaders, Effects 11, Address Library, SkyrimBridge, or Bethesda shader source. Install one supported shader host and the required game and runtime dependencies separately.",
      "inputs": [
        "Skyrim scene, depth, weather, time, interior, bloom, lens, and adaptation data",
        "one supported shader host and one selected quality-tier overlay",
        "optional native camera data and SkyrimBridge celestial data"
      ],
      "outputs": [
        "a nine-stage Skyrim ENB shader suite",
        "procedural sky, cloud, aurora, optical, exposure, color, and tone-mapped frame output",
        "deterministic release-candidate archives, WARP reference captures, and verification reports"
      ],
      "dependencies": [
        "enb-runtime-core"
      ],
      "related": [
        "skyrimbridge",
        "elder-enb"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "ENB shader suite",
      "releaseState": "release-candidate source 1.0.0; tag v1.0.0-rc.1"
    },
    {
      "id": "enb-runtime-core",
      "name": "ENB Runtime Core",
      "purpose": "Provide a C++23 embedded runtime library that identifies an already-loaded ENBSeries host, validates its SDK surface, queues callbacks outside callback context, coordinates save quiescence and reapplication, and gates a fail-closed Skyrim engine bridge.",
      "useCases": [
        "ENB runtime integration",
        "graphics plugin inspection",
        "hosted runtime development"
      ],
      "href": "enb-runtime-core.html",
      "sourceHref": "https://github.com/HarperZ9/enb-runtime-core",
      "domains": [
        "graphics-media",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "embedded-runtime-library",
      "audiences": [
        "graphics engineers",
        "mod developers"
      ],
      "deploymentContexts": [
        "creative production pipelines",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "inspect",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "enb-runtime-core-public-source-0-1-0",
          "type": "source",
          "label": "ENB Runtime Core public source 0.1.0",
          "href": "https://github.com/HarperZ9/enb-runtime-core",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public README identifies a C++23 runtime library for an already-loaded ENBSeries host, callback queueing, save quiescence, fail-closed bridge behavior, and no third-party runtime dependencies; no GitHub release tag was returned."
        }
      ],
      "limitations": [
        "Requires an already-loaded ENBSeries host.",
        "Public source 0.1.0 is not presented as a GitHub release."
      ],
      "boundary": "Use only with a permitted host runtime and the rights required by its owners.",
      "inputs": [
        "already-loaded ENBSeries host",
        "callback and save-lifecycle events",
        "optional Skyrim bridge state"
      ],
      "outputs": [
        "validated host fingerprint",
        "queued callback dispatch",
        "save quiescence and reapplication state",
        "fail-closed bridge status"
      ],
      "dependencies": [
        "already-loaded ENBSeries host",
        "Windows system APIs"
      ],
      "related": [
        "elder-enb",
        "truth-enb",
        "skyrimbridge"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "embedded runtime library",
      "releaseState": "active source 0.1.0; no GitHub release"
    },
    {
      "id": "skyrimbridge",
      "name": "SkyrimBridge",
      "purpose": "Expose Skyrim live engine state, record editing surfaces, asset conversion, versioned ABI, diagnostics, and shared-memory command channels to shaders and external tools through an SKSE plugin, with an optional D3D11 rendering tier.",
      "useCases": [
        "Skyrim runtime integration",
        "graphics bridge inspection",
        "public build review"
      ],
      "href": "skyrimbridge.html",
      "sourceHref": "https://github.com/HarperZ9/skyrimbridge",
      "domains": [
        "graphics-media",
        "developer-infrastructure"
      ],
      "family": "graphics-retro",
      "architectureRole": "skse-state-record-asset-abi-system",
      "audiences": [
        "graphics engineers",
        "mod developers"
      ],
      "deploymentContexts": [
        "creative production pipelines",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "inspect",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "skyrimbridge-public-source-3-0-0",
          "type": "source",
          "label": "SkyrimBridge public source 3.0.0",
          "href": "https://github.com/HarperZ9/skyrimbridge",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public README describes an SKSE plugin with live state domains, versioned ABI, record editing, asset pipelines, command channel, optional D3D11 rendering tier, 17 offline harnesses, and public builds with native replacements off by default."
        }
      ],
      "limitations": [
        "The public/default build excludes the native replacement suite.",
        "The latest tag v3.0.0-rc.1 is a prerelease candidate, not a stable release.",
        "In-game acceptance remains required for write-path and renderer-facing features."
      ],
      "boundary": "Use only with the game, runtime, and asset rights required by their owners.",
      "inputs": [
        "live Skyrim engine state",
        "shared-memory and in-process commands",
        "record edits",
        "texture and model conversion requests"
      ],
      "outputs": [
        "shader-facing game-state channels",
        "runtime record changes",
        "converted assets and collision",
        "diagnostics and automation results"
      ],
      "dependencies": [
        "Skyrim SE/AE/VR",
        "SKSE or SKSEVR",
        "Address Library",
        "CommonLibSSE-NG"
      ],
      "related": [
        "elder-enb",
        "truth-enb",
        "enb-runtime-core",
        "raw"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "graphics-media",
      "productType": "SKSE state, record, asset, ABI, and optional renderer system",
      "releaseState": "prerelease v3.0.0-rc.1"
    },
    {
      "id": "phantom",
      "name": "Phantom",
      "purpose": "Audit and change reversible hardware-identity surfaces on owned or expressly authorized Windows and Linux systems, with backup and revert.",
      "useCases": [
        "hardware-identity privacy",
        "authorized device-surface auditing",
        "reversible identity profiles"
      ],
      "href": "phantom.html",
      "sourceHref": "https://github.com/HarperZ9/phantom",
      "domains": [
        "security-privacy"
      ],
      "family": "security",
      "architectureRole": "reversible-device-identity-system",
      "audiences": [
        "authorized security teams"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems"
      ],
      "maturity": "shipped",
      "placement": "featured",
      "accessMode": "install",
      "entryCommand": "Download a v1.1.0 release asset and compare its hash with SHA256SUMS.txt.",
      "verificationCommand": "phantom --version; phantom audit",
      "evidence": [
        {
          "id": "phantom-release-v1-1-0",
          "type": "release",
          "label": "Phantom v1.1.0",
          "href": "https://github.com/HarperZ9/phantom/releases/tag/v1.1.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The public release exposes v1.1.0 assets for Windows and Linux."
        }
      ],
      "limitations": [
        "Phantom covers Layer 2 identity surfaces; kernel and firmware layers are modeled but not shipped end to end.",
        "The Windows installer is unsigned, and platform controls differ between Windows and Linux."
      ],
      "boundary": "Use only on machines you own or are expressly authorized to test; do not use it for fraud, anti-cheat targeting, or unauthorized access.",
      "inputs": [
        "owned or authorized Windows or Linux host",
        "hardware-identity audit scope",
        "selected identity profile"
      ],
      "outputs": [
        "identifier audit",
        "consistent reversible identity profile",
        "validation report",
        "exact restore backup"
      ],
      "dependencies": [],
      "related": [
        "behavior-transform",
        "array",
        "seed",
        "accountable-surface"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "hardware-identity privacy system",
      "releaseState": "stable v1.1.0"
    },
    {
      "id": "behavior-transform",
      "name": "behavior-transform.io",
      "purpose": "behavior-transform.io is a local Python wrapper and hook layer for file reads and writes, subprocesses, HTTP fetches, operator input, and MCP traffic. It accepts an I/O request plus an operations or research mode and local text rules, then passes through or transforms the content and returns the requested result with hashes, substitution counts, return codes, or local audit artifacts.",
      "useCases": [
        "local I/O wrapping and transformation",
        "policy-aware IO",
        "session and action auditing"
      ],
      "href": "systems/behavior-transform.html",
      "sourceHref": "https://github.com/HarperZ9/behavior-transform.io",
      "domains": [
        "security-privacy",
        "agent-systems",
        "developer-infrastructure"
      ],
      "family": "security",
      "architectureRole": "io-boundary-and-receipt-layer",
      "audiences": [
        "authorized security teams",
        "agent-system engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "controlled agent workflows",
        "local development workspaces"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "inspect",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "behavior-transform-public-source",
          "type": "source",
          "label": "behavior-transform.io public source",
          "href": "https://github.com/HarperZ9/behavior-transform.io",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "A public main branch exists; no tagged release, supported install command, or production adoption is claimed."
        }
      ],
      "limitations": [
        "No tagged release or publicly verified entry command is claimed.",
        "Local audit artifacts and hashes record selected observations; they do not guarantee provider acceptance or substantive safety."
      ],
      "boundary": "Use the boundary only within the operator's authority and governing provider, data-owner, and system policies.",
      "inputs": [
        "read, write, fetch, execute, input, and model-boundary events",
        "declared policy and session context"
      ],
      "outputs": [
        "requested I/O results",
        "content hashes and substitution counts",
        "return codes and local audit artifacts"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "phantom",
        "accountable-surface",
        "bounds"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "local I/O wrapper and hook layer",
      "releaseState": "active public source; no tagged release"
    },
    {
      "id": "array",
      "name": "Array",
      "purpose": "Orchestrate authorized offensive-security campaigns through digest-sealed waves, time-limited approval, contained tool supervision, cleanup, and a verifiable evidence ledger.",
      "useCases": [
        "authorized offensive-security campaign planning",
        "approval-gated assessment execution",
        "campaign cleanup and evidence review"
      ],
      "href": "array.html",
      "sourceHref": null,
      "domains": [
        "security-privacy"
      ],
      "family": "security",
      "architectureRole": "approval-gated-campaign-orchestrator",
      "audiences": [
        "authorized red teams",
        "security engagement leads",
        "remediation owners"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "isolated assessment environments",
        "approved private recipient channels"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "array-public-capability-description",
          "type": "public-receipt",
          "label": "Array public capability description",
          "href": "https://harperz9.github.io/array.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Array's campaign planning, approval, containment, cleanup, and evidence-ledger role. Private source and operational material are not public evidence."
        }
      ],
      "limitations": [
        "The public record does not expose targets, credentials, live payloads, client data, or engagement-specific findings.",
        "The public capability description does not establish third-party deployment, effectiveness, or outcome."
      ],
      "boundary": "Operational use requires written authorization, a defined scope, an approved environment, and a remediation owner. Sensitive methods and findings move only through approved private or embargoed channels.",
      "inputs": [
        "written campaign authority and scope",
        "approved assessment objectives",
        "registered assessment tools and containment policy"
      ],
      "outputs": [
        "approval-gated campaign waves",
        "cleanup and finding records",
        "campaign evidence ledger"
      ],
      "dependencies": [
        "independent containment monitor",
        "registered assessment-tool descriptors"
      ],
      "related": [
        "seed",
        "sofer",
        "orca",
        "gate",
        "phantom"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "security-privacy",
      "productType": "authorized offensive campaign orchestrator",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "seed",
      "name": "Seed",
      "purpose": "Run native security assessment and detection-engineering work through a C++23 engine with synthetic demonstrations, scope manifests, interop adapters, and action receipts.",
      "useCases": [
        "controlled security-assessment labs",
        "detection engineering",
        "authorized native assessment and training"
      ],
      "href": "seed.html",
      "sourceHref": null,
      "domains": [
        "security-privacy"
      ],
      "family": "security",
      "architectureRole": "native-security-assessment-engine",
      "audiences": [
        "authorized security teams",
        "detection engineers",
        "native-systems assessors"
      ],
      "deploymentContexts": [
        "controlled assessment labs",
        "owned or expressly authorized systems",
        "private training environments"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "seed-public-capability-description",
          "type": "public-receipt",
          "label": "Seed public capability description",
          "href": "https://harperz9.github.io/seed.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page identifies Seed as a C++23 assessment engine and describes its bounded assessment surfaces. Private source and operational material are not public evidence."
        }
      ],
      "limitations": [
        "Module and test counts describe the inspected owner-controlled codebase; they do not establish independent review or field effectiveness.",
        "The public record omits deployable assessment details, targets, credentials, live payloads, and client data."
      ],
      "boundary": "Use requires written authorization and an approved assessment or training environment. Operational artifacts remain in the approved private channel.",
      "inputs": [
        "scope manifest",
        "approved synthetic fixtures or assessment environment",
        "module descriptors and native test cases"
      ],
      "outputs": [
        "native assessment results",
        "detection-engineering evidence",
        "action receipts and interop results"
      ],
      "dependencies": [
        "C++23 runtime and build toolchain",
        "approved scope manifest"
      ],
      "related": [
        "array",
        "orca",
        "gate"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "security-privacy",
      "productType": "native security-assessment engine",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "sofer",
      "name": "Sofer",
      "purpose": "Sofer is a private Python platform for authorized security operations. It coordinates scoped reconnaissance, adversarial testing, defensive analysis, campaign execution, finding management, and disclosure, then produces evidence-backed findings, reports, receipts, and handoffs.",
      "useCases": [
        "private-line multi-agent orchestration",
        "high-consequence technical workflow coordination",
        "receipt-backed specialist handoffs"
      ],
      "href": "sofer.html",
      "sourceHref": null,
      "domains": [
        "security-privacy",
        "agent-systems"
      ],
      "family": "security",
      "architectureRole": "private-line-multi-domain-orchestrator",
      "audiences": [
        "authorized technical operators",
        "security and infrastructure teams",
        "high-consequence workflow owners"
      ],
      "deploymentContexts": [
        "approved private operations",
        "controlled multi-agent workflows",
        "private or embargoed recipient channels"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "sofer-public-capability-description",
          "type": "public-receipt",
          "label": "Sofer public capability description",
          "href": "https://harperz9.github.io/sofer.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Sofer's specialist-agent, model-backend, workflow, admission, and handoff role. Private source and operational material are not public evidence."
        }
      ],
      "limitations": [
        "The public capability description does not establish deployment across every named domain or third-party acceptance.",
        "Private workflow definitions, operational data, targets, credentials, and client material are not published."
      ],
      "boundary": "Every workflow requires operator authority, approved tools and data, and an accountable recipient. Sensitive operational material stays in the approved private channel.",
      "inputs": [
        "authorized workflow objective",
        "admitted specialist agents and model backends",
        "approved probes, intelligence, and scheduling inputs"
      ],
      "outputs": [
        "multi-stage workflow decisions",
        "tool-execution and admission records",
        "receipt-backed specialist handoffs"
      ],
      "dependencies": [
        "approved agent and model-backend adapters",
        "admission policy",
        "receipt store"
      ],
      "related": [
        "array",
        "orca",
        "gate",
        "flywheel"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "agent-systems",
      "productType": "private-line orchestration suite",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "isomorph",
      "name": "Isomorph",
      "purpose": "Evaluate classifier and refusal behavior at authorized AI inference boundaries through controlled reformulation trials, provider-specific result records, and control-stability analysis.",
      "useCases": [
        "authorized AI red-team evaluation",
        "classifier and refusal-behavior measurement",
        "inference-control stability analysis"
      ],
      "href": "isomorph.html",
      "sourceHref": null,
      "domains": [
        "security-privacy",
        "evaluation-verification"
      ],
      "family": "security",
      "architectureRole": "inference-boundary-red-team-harness",
      "audiences": [
        "authorized AI red teams",
        "model safety evaluators",
        "inference-control owners"
      ],
      "deploymentContexts": [
        "approved model evaluation environments",
        "private safety assessments",
        "authorized provider testing"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "isomorph-public-capability-description",
          "type": "public-receipt",
          "label": "Isomorph public capability description",
          "href": "https://harperz9.github.io/isomorph.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Isomorph's inference-boundary refusal and classifier evaluation role while withholding operational test material."
        }
      ],
      "limitations": [
        "The public record intentionally omits live jailbreak corpora, bypass payloads, target-specific methods, provider findings, and deployable sequences.",
        "Observed control behavior is specific to the authorized evaluation context and does not establish universal model behavior."
      ],
      "boundary": "Jailbreak-class mechanisms may be used only within an authorized, approved evaluation scope. Test material and findings move through the provider's or recipient's controlled disclosure channel.",
      "inputs": [
        "authorized inference endpoint or local model",
        "approved evaluation prompts and reformulation policy",
        "provider and scope metadata"
      ],
      "outputs": [
        "classifier and refusal-behavior measurements",
        "provider-scoped evaluation records",
        "control-stability analysis"
      ],
      "dependencies": [
        "approved inference adapter",
        "evaluation authorization and scope",
        "controlled evidence store"
      ],
      "related": [
        "bounds",
        "gate",
        "accountable-surface"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "evaluation-verification",
      "productType": "AI inference-boundary red-team harness",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "bounds",
      "name": "Bounds",
      "purpose": "Bounds checks agent actions, runtime observations, and release candidates for intent drift, unsupported claims, secret exposure, and failed fixtures, then writes receipts and proof chains or blocks the release path.",
      "useCases": [
        "agent-action trust verification",
        "runtime and claim-drift detection",
        "release inventory and proof-chain construction"
      ],
      "href": "bounds.html",
      "sourceHref": null,
      "domains": [
        "security-privacy",
        "evaluation-verification",
        "agent-systems"
      ],
      "family": "security",
      "architectureRole": "agent-runtime-release-trust-verifier",
      "audiences": [
        "agent-system engineers",
        "release reviewers",
        "authorized security teams"
      ],
      "deploymentContexts": [
        "controlled agent workflows",
        "review and release lanes",
        "owned or expressly authorized repositories and runtimes"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "bounds-public-capability-description",
          "type": "public-receipt",
          "label": "Bounds public capability description",
          "href": "https://harperz9.github.io/bounds.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Bounds' sensor, guard, receipt, release-inventory, and proof-chain role. Private source and runtime material are not public evidence."
        }
      ],
      "limitations": [
        "Receipts and proof chains report configured checks and observed evidence; they do not guarantee correctness, safety, or absence of compromise.",
        "Private sensor configuration, runtime observations, credentials, and protected evidence are not published."
      ],
      "boundary": "Inspect only authorized actions, runtimes, repositories, and evidence. Protected observations and proof material remain in the approved review channel.",
      "inputs": [
        "agent-action and runtime observations",
        "file, git, claim, secret, and fixture sensor inputs",
        "release policy and inventory scope"
      ],
      "outputs": [
        "intent-drift and unsupported-claim findings",
        "evidence-backed trust receipts",
        "release inventories and tamper-evident proof chains"
      ],
      "dependencies": [
        "explicit sensor and guard configuration",
        "authorized evidence sources"
      ],
      "related": [
        "isomorph",
        "gate",
        "proof-surface",
        "behavior-transform",
        "accountable-surface"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "evaluation-verification",
      "productType": "agent, runtime, and release trust verifier",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "orca",
      "name": "ORCA",
      "purpose": "Operate private-line assessments by managing engagement state, executing descriptor-backed modules, cataloging findings and artifacts, producing reports and portable bundles, and recording release provenance.",
      "useCases": [
        "private assessment operation",
        "finding and artifact cataloging",
        "report and portable-bundle handoff"
      ],
      "href": "private-practice.html#orca",
      "sourceHref": null,
      "domains": [
        "security-privacy"
      ],
      "family": "security",
      "architectureRole": "private-assessment-operator-runtime",
      "audiences": [
        "authorized assessment operators",
        "security engagement leads",
        "review and remediation teams"
      ],
      "deploymentContexts": [
        "private-line assessment environments",
        "owned or expressly authorized systems",
        "controlled report handoffs"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "orca-public-capability-description",
          "type": "public-receipt",
          "label": "ORCA public capability description",
          "href": "https://harperz9.github.io/private-practice.html#orca",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes ORCA's engagement-state, module execution, finding catalog, reporting, bundle, provenance, doctor, and console surfaces."
        }
      ],
      "limitations": [
        "The public capability description does not expose module implementations, targets, credentials, live payloads, findings, or client data.",
        "A portable bundle records an engagement handoff; it does not by itself establish remediation or outcome."
      ],
      "boundary": "Operate only within a written, authorized engagement scope. Reports, findings, artifacts, and portable bundles go only to the approved recipient.",
      "inputs": [
        "authorized engagement state",
        "approved descriptor-backed modules",
        "assessment findings and artifacts"
      ],
      "outputs": [
        "module execution records",
        "finding and artifact catalog",
        "reports, portable bundles, and release provenance"
      ],
      "dependencies": [
        "approved module descriptors",
        "private engagement-state store"
      ],
      "related": [
        "array",
        "seed",
        "sofer",
        "gate"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "security-privacy",
      "productType": "native assessment operator runtime",
      "releaseState": "controlled private system; public capability description"
    },
    {
      "id": "gate",
      "name": "Gate",
      "purpose": "Gate is Sofer's private release-check subsystem. Its Python command-line tools validate readiness, operations, engagement, deliverable, and release manifests; required source, documentation, and test paths; configured controls; and verification-command results. Gate returns pass or fail findings, writes hashed JSON receipts, and blocks advancement when required evidence or controls are missing.",
      "useCases": [
        "private-system release readiness",
        "supply-chain and package verification",
        "receipt-backed release handoff"
      ],
      "href": "private-practice.html#gate",
      "sourceHref": null,
      "domains": [
        "security-privacy",
        "developer-infrastructure",
        "evaluation-verification"
      ],
      "family": "security",
      "architectureRole": "sofer-private-release-check-subsystem",
      "audiences": [
        "release owners",
        "security engineering leads",
        "private-system integrators"
      ],
      "deploymentContexts": [
        "private integration pipelines",
        "controlled release reviews",
        "approved recipient handoffs"
      ],
      "maturity": "controlled-private",
      "placement": "featured",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "gate-public-capability-description",
          "type": "public-receipt",
          "label": "Gate public capability description",
          "href": "https://harperz9.github.io/private-practice.html#gate",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Gate's readiness, CI, MCP, safety-evaluation, SBOM, supply-chain, package-verification, and fail-closed handoff role."
        }
      ],
      "limitations": [
        "A passing release decision reports satisfaction of configured gates; it does not certify universal safety, security, or fitness.",
        "Private CI, package, SBOM, supply-chain, and handoff evidence are not published."
      ],
      "boundary": "Release decisions apply only to the reviewed components, evidence, scope, and recipient. Protected release evidence remains in the approved handoff channel.",
      "inputs": [
        "component readiness and CI results",
        "MCP and safety-evaluation posture",
        "SBOM, supply-chain, package, and handoff evidence"
      ],
      "outputs": [
        "fail-closed release decision",
        "component and package verification findings",
        "receipt-backed handoff record"
      ],
      "dependencies": [
        "private-system readiness records",
        "CI and package-verification evidence",
        "approved release policy"
      ],
      "related": [
        "array",
        "seed",
        "sofer",
        "isomorph",
        "bounds",
        "orca"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "developer-infrastructure",
      "productType": "Sofer release-check subsystem",
      "releaseState": "controlled Sofer subsystem; public capability description"
    },
    {
      "id": "accountable-surface",
      "name": "Accountable Surface",
      "purpose": "Accountable Surface is a Python runtime for executing bounded file, command, web, and browser actions under operator-supplied grants. It accepts an exact proposed action and target, an external authorization receipt, effector bounds, and an expected result; it returns an allow, deny, or needs-human outcome, performs only permitted effects, re-observes and verifies the result, rolls back reversible failures, and appends a hash-chained journal.",
      "useCases": [
        "bounded agent actions",
        "rollback-aware automation",
        "action receipt review"
      ],
      "href": "accountable-surface.html",
      "sourceHref": "https://github.com/HarperZ9/accountable-surface",
      "domains": [
        "security-privacy",
        "evaluation-verification",
        "agent-systems"
      ],
      "family": "security",
      "architectureRole": "controlled-agent-action-workbench",
      "audiences": [
        "authorized security teams",
        "evaluation engineers",
        "agent-system engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "review and CI lanes",
        "controlled agent workflows"
      ],
      "maturity": "active",
      "placement": "featured",
      "accessMode": "inspect",
      "entryCommand": "python -m pip install -e \\".[test]\\"; python examples/demo.py",
      "verificationCommand": "python -m pytest",
      "evidence": [
        {
          "id": "accountable-surface-public-source",
          "type": "source",
          "label": "Accountable Surface public source",
          "href": "https://github.com/HarperZ9/accountable-surface",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The public repository identifies source 0.1.0 and no tagged release; self-authored tests are not independent review."
        }
      ],
      "limitations": [
        "The model cannot supply its own authorization.",
        "Self-authored tests do not establish independent adversarial review or production safety."
      ],
      "boundary": "Every effect requires authority external to the model and remains limited to the granted scope.",
      "inputs": [
        "perceived interface structure",
        "externally supplied action grants",
        "bounded effector requests",
        "rollback policy"
      ],
      "outputs": [
        "authorized effects or denials",
        "post-action re-perception",
        "rollback results",
        "durable action journal"
      ],
      "dependencies": [],
      "related": [
        "flywheel",
        "emet",
        "behavior-transform",
        "bounds",
        "isomorph"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "controlled agent-action workbench",
      "releaseState": "active source 0.1.0; no release"
    },
    {
      "id": "public-surface-sweeper",
      "name": "Public Surface Sweeper",
      "purpose": "Audit required public files, text hygiene, secret-shaped values, and proof-packet readiness.",
      "useCases": [
        "public repository hygiene",
        "release-surface checks",
        "proof-packet readiness"
      ],
      "href": "public-surface-sweeper-sample.html",
      "sourceHref": "https://github.com/HarperZ9/public-surface-sweeper",
      "domains": [
        "security-privacy",
        "developer-infrastructure"
      ],
      "family": "security",
      "architectureRole": "release-surface-auditor",
      "audiences": [
        "authorized security teams",
        "software engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install public-surface-sweeper; public-surface-sweeper . --summary",
      "verificationCommand": "python -m pip install -e \\".[test]\\"; public-surface-sweeper examples/clean-repo; python -m pytest",
      "evidence": [
        {
          "id": "public-surface-sweeper-release-v0-1-1",
          "type": "release",
          "label": "Public Surface Sweeper v0.1.1",
          "href": "https://github.com/HarperZ9/public-surface-sweeper/releases/tag/v0.1.1",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The latest tagged release is v0.1.1; newer source metadata is not presented as released."
        }
      ],
      "limitations": [
        "This is not an exploit tester, dependency vulnerability scanner, credential validator, compliance certification, or replacement for security review.",
        "A secret-shaped finding does not establish that the value is a live credential."
      ],
      "boundary": "Scan only repositories and artifacts you are authorized to inspect.",
      "inputs": [
        "repository or release directory",
        "required-file and text-hygiene policy",
        "secret-shape rules",
        "proof-packet contracts"
      ],
      "outputs": [
        "public-file and hygiene findings",
        "secret-shaped-value findings",
        "proof-packet readiness summary"
      ],
      "dependencies": [],
      "related": [
        "model-provenance-validator",
        "secret-redact-io",
        "agent-hook-pack",
        "repo-proof-index"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "public release-surface auditor",
      "releaseState": "stable v0.1.1"
    },
    {
      "id": "model-provenance-validator",
      "name": "Model Provenance Validator",
      "purpose": "Validate the schema, source references, retrieval dates, and publishable status of compact model and release provenance envelopes, scrub sensitive output, and emit proof-surface packets without certifying underlying truth.",
      "useCases": [
        "release provenance checks",
        "model claim envelopes",
        "redacted validation output"
      ],
      "href": "security-toolkit.html#model-provenance-validator",
      "sourceHref": "https://github.com/HarperZ9/model-provenance-validator",
      "domains": [
        "security-privacy",
        "evaluation-verification"
      ],
      "family": "verification",
      "architectureRole": "provenance-envelope-validator",
      "audiences": [
        "authorized security teams",
        "evaluation engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "review and CI lanes"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install model-provenance-validator; model-provenance-validator examples/envelopes/release.provenance.json",
      "verificationCommand": "python -m pip install -e \\".[test]\\"; model-provenance-validator examples/envelopes/release.provenance.json; python -m pytest",
      "evidence": [
        {
          "id": "model-provenance-validator-release-v0-1-1",
          "type": "release",
          "label": "Model Provenance Validator v0.1.1",
          "href": "https://github.com/HarperZ9/model-provenance-validator/releases/tag/v0.1.1",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v0.1.1 public release was verified."
        }
      ],
      "limitations": [
        "The validator does not fetch sources, decide underlying truth, prove model safety, certify provenance, or replace human review."
      ],
      "boundary": "Validate only public or authorized envelopes and keep protected source evidence outside public output.",
      "inputs": [
        "model or release provenance envelope",
        "schema and publishability policy",
        "local source-reference context"
      ],
      "outputs": [
        "validation findings",
        "redacted summaries",
        "proof-surface packets"
      ],
      "dependencies": [
        "proof-surface>=0.1"
      ],
      "related": [
        "public-surface-sweeper",
        "repo-proof-index",
        "emet"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "evaluation-verification",
      "productType": "model provenance-envelope validator",
      "releaseState": "alpha v0.1.1"
    },
    {
      "id": "secret-redact-io",
      "name": "Secret Redact IO",
      "purpose": "Provide guarded Python IO helpers that redact file, fetch, write, and subprocess output while emitting hash-only receipts.",
      "useCases": [
        "secret-aware IO",
        "redacted subprocess capture",
        "hash-only evidence receipts"
      ],
      "href": "security-toolkit.html#secret-redact-io",
      "sourceHref": "https://github.com/HarperZ9/secret-redact-io",
      "domains": [
        "security-privacy",
        "developer-infrastructure"
      ],
      "family": "security",
      "architectureRole": "guarded-io-library",
      "audiences": [
        "authorized security teams",
        "software engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install secret-redact-io; secret-redact-io read README.md --json",
      "verificationCommand": "python -m pip install -e \\".[dev]\\"; python -m pytest",
      "evidence": [
        {
          "id": "secret-redact-io-release-v0-1-0",
          "type": "release",
          "label": "Secret Redact IO v0.1.0",
          "href": "https://github.com/HarperZ9/secret-redact-io/releases/tag/v0.1.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v0.1.0 public release was verified."
        }
      ],
      "limitations": [
        "The package does not include credentials or environment configuration.",
        "Redaction and hash-only receipts reduce exposure but do not replace source review."
      ],
      "boundary": "Do not pass secrets to destinations that are not authorized to receive them, even when redaction is enabled.",
      "inputs": [
        "file, fetch, write, or subprocess request",
        "redaction patterns and output policy"
      ],
      "outputs": [
        "redacted I/O result",
        "hash-only receipt",
        "secret-shape findings"
      ],
      "dependencies": [],
      "related": [
        "public-surface-sweeper",
        "agent-hook-pack",
        "model-provenance-validator"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "security-privacy",
      "productType": "secret-aware I/O helper library",
      "releaseState": "stable v0.1.0"
    },
    {
      "id": "agent-hook-pack",
      "name": "Agent Hook Pack",
      "purpose": "Install public-safe hooks for secret checks, branch guards, environment synchronization, and repository hygiene.",
      "useCases": [
        "pre-commit hygiene",
        "branch protection",
        "agent environment checks"
      ],
      "href": "security-toolkit.html#agent-hook-pack",
      "sourceHref": "https://github.com/HarperZ9/agent-hook-pack",
      "domains": [
        "security-privacy",
        "developer-infrastructure"
      ],
      "family": "security",
      "architectureRole": "repository-hook-toolkit",
      "audiences": [
        "authorized security teams",
        "software engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install -e .; agent-hook-pack audit; agent-hook-pack list",
      "verificationCommand": "python -m pip install -e \\".[test]\\"; agent-hook-pack audit; python -m pytest",
      "evidence": [
        {
          "id": "agent-hook-pack-release-v0-1-0",
          "type": "release",
          "label": "Agent Hook Pack v0.1.0",
          "href": "https://github.com/HarperZ9/agent-hook-pack/releases/tag/v0.1.0",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v0.1.0 public release was verified."
        }
      ],
      "limitations": [
        "Private policy layers are intentionally omitted from the public package.",
        "Generic hooks cannot prove a repository or agent workflow is safe."
      ],
      "boundary": "Hooks support, but do not replace, repository-specific policy and human review.",
      "inputs": [
        "repository configuration",
        "branch and environment policy",
        "hook selection"
      ],
      "outputs": [
        "installed public-safe hooks",
        "branch and secret check results",
        "environment synchronization findings"
      ],
      "dependencies": [],
      "related": [
        "public-surface-sweeper",
        "secret-redact-io",
        "repo-proof-index"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "developer-infrastructure",
      "productType": "repository hook toolkit",
      "releaseState": "stable v0.1.0"
    },
    {
      "id": "repo-proof-index",
      "name": "Repo Proof Index",
      "purpose": "Scan proof contracts, proof-surface packets, receipt bundles, and witness receipts into schema-tolerant reviewer summaries while validating known proof-surface contracts without judging sufficiency.",
      "useCases": [
        "proof-packet indexing",
        "receipt discovery",
        "reviewer-ready evidence summaries"
      ],
      "href": "security-toolkit.html#repo-proof-index",
      "sourceHref": "https://github.com/HarperZ9/repo-proof-index",
      "domains": [
        "security-privacy",
        "evaluation-verification",
        "developer-infrastructure"
      ],
      "family": "verification",
      "architectureRole": "evidence-index-and-review-handoff",
      "audiences": [
        "authorized security teams",
        "evaluation engineers",
        "software engineers"
      ],
      "deploymentContexts": [
        "owned or expressly authorized systems",
        "review and CI lanes",
        "local development workspaces"
      ],
      "maturity": "shipped",
      "placement": "catalog-only",
      "accessMode": "install",
      "entryCommand": "python -m pip install repo-proof-index; repo-proof-index contracts/*.json --summary",
      "verificationCommand": "python -m pip install -e \\".[test]\\"; repo-proof-index examples/contracts/*.json --summary; python -m pytest",
      "evidence": [
        {
          "id": "repo-proof-index-release-v0-1-1",
          "type": "release",
          "label": "Repo Proof Index v0.1.1",
          "href": "https://github.com/HarperZ9/repo-proof-index/releases/tag/v0.1.1",
          "date": "2026-08-27",
          "status": "verified",
          "summary": "The v0.1.1 public release was verified."
        }
      ],
      "limitations": [
        "The index does not decide whether evidence is sufficient, validate arbitrary schemas, or read referenced private payloads."
      ],
      "boundary": "Index only public or authorized evidence and keep private payloads outside public summaries.",
      "inputs": [
        "proof contracts and packets",
        "receipt bundles",
        "witness receipts"
      ],
      "outputs": [
        "schema-tolerant evidence index",
        "reviewer summaries",
        "known-contract validation findings"
      ],
      "dependencies": [
        "proof-surface>=0.1"
      ],
      "related": [
        "emet",
        "model-provenance-validator",
        "public-surface-sweeper"
      ],
      "lastVerified": "2026-08-27",
      "primaryDomain": "evaluation-verification",
      "productType": "evidence index and reviewer handoff",
      "releaseState": "alpha v0.1.1"
    },
    {
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "run",
      "boundary": "Use only source material and systems you are authorized to access; preserve privacy, licensing, and source provenance.",
      "lastVerified": "2026-08-28",
      "id": "chorus",
      "name": "Chorus",
      "purpose": "Turn a captured comment or thread corpus into weighted, clustered, re-checkable discourse digests that rank themes, surface dissent, and identify genuinely contested topics.",
      "useCases": [
        "community and comment research",
        "ranked theme and controversy analysis",
        "change-triggered discourse monitoring"
      ],
      "href": "chorus.html",
      "sourceHref": "https://github.com/HarperZ9/chorus",
      "domains": [
        "research-education",
        "developer-infrastructure"
      ],
      "primaryDomain": "research-education",
      "family": "research-education",
      "productType": "discourse synthesis system",
      "architectureRole": "discourse-synthesis-system",
      "audiences": [
        "researchers",
        "community analysts",
        "software engineers"
      ],
      "deploymentContexts": [
        "local research corpora",
        "community and comment analysis",
        "Flywheel discourse bridge"
      ],
      "releaseState": "active source 0.1.0; no PyPI or GitHub release",
      "entryCommand": "python -m pip install -e .; chorus run examples/discourse-sample.json --verify",
      "verificationCommand": "python -m pytest",
      "evidence": [
        {
          "id": "chorus-public-source-0-1-0",
          "type": "source",
          "label": "Chorus source 0.1.0",
          "href": "https://github.com/HarperZ9/chorus",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public source implements weighted lexical theme clustering, controversy ranking, receipts, Gather-corpus input, and an optional separately-provenanced model overlay. No package or GitHub release is claimed."
        },
        {
          "id": "chorus-gather-corpus-code",
          "type": "code-permalink",
          "label": "Chorus Gather-corpus loader",
          "href": "https://github.com/HarperZ9/chorus/blob/d88da755850fb6827c6faf25d73ae3bbc226062e/src/chorus/cli.py#L21-L38",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The pinned CLI source loads Gather corpus directories through catalog.jsonl and the content-addressed object layout."
        }
      ],
      "limitations": [
        "Core sentiment is English and literal; sarcasm and context can be missed.",
        "Lexical clustering is not semantic equivalence.",
        "The optional model overlay is advisory and excluded from the re-checkable core digest."
      ],
      "inputs": [
        "Gather corpus directory or JSON comment rows",
        "weighting and clustering configuration",
        "optional model-overlay configuration"
      ],
      "outputs": [
        "ranked theme digest",
        "controversy and dissent analysis",
        "split-topic findings",
        "verification receipt"
      ],
      "dependencies": [],
      "related": [
        "gather",
        "flywheel"
      ]
    },
    {
      "maturity": "active",
      "placement": "catalog-only",
      "accessMode": "run",
      "boundary": "RAW requires an owned Skyrim installation and its declared runtime and build dependencies. It does not bundle Bethesda assets.",
      "lastVerified": "2026-08-28",
      "id": "raw",
      "name": "RAW",
      "purpose": "Develop a D3D11 rendering platform for Skyrim SE that combines proxy-level pipeline ownership with SKSE-driven mid-frame effect dispatch, hot-reloadable HLSL, frame capture, GPU diagnostics, and a focused set of screen-space lighting and post-processing effects.",
      "useCases": [
        "Skyrim D3D11 render-pipeline development",
        "screen-space lighting and post-processing",
        "GPU frame capture and diagnostics"
      ],
      "href": "raw.html",
      "sourceHref": "https://github.com/HarperZ9/RAW",
      "domains": [
        "graphics-media",
        "developer-infrastructure"
      ],
      "primaryDomain": "graphics-media",
      "family": "graphics-retro",
      "productType": "Skyrim D3D11 rendering platform",
      "architectureRole": "skyrim-d3d11-rendering-platform",
      "audiences": [
        "Skyrim graphics developers",
        "D3D11 rendering engineers",
        "shader authors"
      ],
      "deploymentContexts": [
        "Skyrim SE with SKSE",
        "local D3D11 graphics development"
      ],
      "releaseState": "active source 1.0.0; no public release",
      "entryCommand": "cmake --preset windows-release; cmake --build --preset windows-release",
      "verificationCommand": "cmake --build --preset windows-debug; ctest --preset windows-debug --output-on-failure",
      "evidence": [
        {
          "id": "raw-public-source-1-0-0",
          "type": "source",
          "label": "RAW source 1.0.0",
          "href": "https://github.com/HarperZ9/RAW",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "CMake builds the SKSE plugin and D3D11 proxy, active pipeline infrastructure, hot-reload and diagnostics, and a bounded set of effects. Several additional renderers remain present but disabled pending testing."
        }
      ],
      "limitations": [
        "No public GitHub release is claimed.",
        "Effects have different readiness levels; disabled source is not presented as active capability.",
        "Live Skyrim and GPU behavior requires hardware and game acceptance testing."
      ],
      "inputs": [
        "Skyrim D3D11 frames and engine state",
        "SKSE integration events",
        "HLSL source and effect configuration"
      ],
      "outputs": [
        "mid-frame D3D11 effect dispatch",
        "screen-space lighting and compositing",
        "frame captures and GPU profiles",
        "hot-reloaded shader results"
      ],
      "dependencies": [
        "Skyrim SE",
        "SKSE",
        "CommonLibSSE-NG",
        "D3D11",
        "DXGI",
        "D3DCompiler",
        "ImGui",
        "RmlUi",
        "FreeType"
      ],
      "related": [
        "skyrimbridge",
        "studio-engine",
        "buildlang"
      ]
    },
    {
      "id": "kun",
      "name": "Kun",
      "purpose": "Maintain local access-recovery memory for owned systems through path-only receipts, redacted diagnostics, rotation notes, and operator runbooks without storing raw credentials.",
      "useCases": [
        "local access-recovery hygiene",
        "credential-rotation memory",
        "redacted operational diagnostics"
      ],
      "href": "kun.html",
      "sourceHref": null,
      "domains": [
        "security-privacy",
        "developer-infrastructure"
      ],
      "family": "security",
      "architectureRole": "local-access-recovery-vault",
      "audiences": [
        "operators of owned systems",
        "security reviewers"
      ],
      "deploymentContexts": [
        "local-only workstations",
        "owned operational environments"
      ],
      "maturity": "controlled-private",
      "placement": "supporting",
      "accessMode": "request",
      "entryCommand": null,
      "verificationCommand": null,
      "evidence": [
        {
          "id": "kun-public-boundary-page",
          "type": "public-receipt",
          "label": "Kun public boundary page",
          "href": "https://harperz9.github.io/kun.html",
          "date": "2026-08-28",
          "status": "verified",
          "summary": "The public page describes Kun's path-only and redacted-receipt role and states that raw credentials, recovery instructions, and protected content are not published."
        }
      ],
      "limitations": [
        "No raw credential, credential value, credential recovery instruction, bypass step, private browser state, or protected content is published.",
        "Path-only receipt design does not replace a dedicated secrets manager."
      ],
      "boundary": "Kun records where recovery authority lives and how to audit the process. It does not publish or retain raw keys, tokens, passwords, seed phrases, private browser state, or protected content.",
      "inputs": [
        "owned-system recovery paths",
        "rotation metadata",
        "redacted diagnostics and local runbook state"
      ],
      "outputs": [
        "path-only receipts",
        "rotation reminders",
        "diagnostic summaries and recovery checklist state"
      ],
      "dependencies": [],
      "related": [
        "bounds",
        "secret-redact-io"
      ],
      "lastVerified": "2026-08-28",
      "primaryDomain": "security-privacy",
      "productType": "local access-recovery vault",
      "releaseState": "controlled private system; public capability page"
    }
  ]
}`),ne=te.systems;ne.filter(e=>e.placement===`featured`);var re=te.domains,w=ne.flatMap(e=>e.evidence.map(t=>({...t,systemId:e.id}))).sort((e,t)=>t.date.localeCompare(e.date));function ie(e){return ne.find(t=>t.id===e)}var ae=`{
  "schema": "harperz9-home-evidence/v1",
  "derivedFrom": "harperz9-systems/v4",
  "records": [
    {
      "id": "flywheel-gather-lane-code",
      "type": "code-permalink",
      "label": "Flywheel Gather lane declaration",
      "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L55-L58",
      "date": "2026-08-28",
      "status": "verified",
      "summary": "The pinned lane registry declares Gather's package, command, MCP arguments, version, source repository, and role.",
      "systemId": "flywheel"
    },
    {
      "id": "flywheel-crucible-lane-code",
      "type": "code-permalink",
      "label": "Flywheel Crucible lane declaration",
      "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L59-L62",
      "date": "2026-08-28",
      "status": "verified",
      "summary": "The pinned lane registry declares Crucible's package, command, MCP arguments, version, source repository, and role.",
      "systemId": "flywheel"
    },
    {
      "id": "flywheel-index-lane-code",
      "type": "code-permalink",
      "label": "Flywheel Index lane declaration",
      "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L63-L66",
      "date": "2026-08-28",
      "status": "verified",
      "summary": "The pinned lane registry declares Index's package, command, MCP arguments, source repository, and role; its version field is visibly stale against the published package.",
      "systemId": "flywheel"
    },
    {
      "id": "flywheel-forum-lane-code",
      "type": "code-permalink",
      "label": "Flywheel Forum lane declaration",
      "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L67-L70",
      "date": "2026-08-28",
      "status": "verified",
      "summary": "The pinned lane registry declares Forum's package, command, MCP arguments, version, source repository, and role.",
      "systemId": "flywheel"
    },
    {
      "id": "flywheel-learn-lane-code",
      "type": "code-permalink",
      "label": "Flywheel Learn lane declaration",
      "href": "https://github.com/HarperZ9/flywheel/blob/3b0a1d5e90326edb59ad010ffdb1e1934b96f19a/harness/lanes.py#L71-L74",
      "date": "2026-08-28",
      "status": "verified",
      "summary": "The pinned lane registry declares Learn's npm package, Node MCP entry, version, source repository, and role.",
      "systemId": "flywheel"
    }
  ],
  "latestPublishedBriefing": {
    "id": "2026-08-26-openai-hugging-face-incident",
    "recordType": "canonical",
    "version": 1,
    "title": "Five evidence lanes, one OpenAI and Hugging Face incident",
    "summary": "Separate legal process, OpenAI's company report, Hugging Face host telemetry, independent analysis, and vendor remediation before drawing conclusions from the July incident.",
    "href": "/briefings/2026-08-26-openai-hugging-face-incident/",
    "publishedAt": "2026-08-26",
    "updatedAt": "2026-08-27",
    "sourceCount": 12,
    "claimCount": 45,
    "figureIds": [
      "recovered-actions-by-day",
      "incident-multilane-timeline",
      "source-scope-matrix",
      "task-overrepresentation",
      "motive-sample-nonexclusive",
      "control-boundary-flow",
      "claim-provenance-panel"
    ],
    "primaryFigureHref": "/figures/source-scope-matrix.html",
    "limitations": [
      "The Alabama materials describe an investigation, subpoena, and allegations. They do not establish a legal violation, liability, or consumer harm.",
      "Actions, clusters, agents, messages, files, transcripts, tasks, repositories, systems, workers, and datasets remain separate units.",
      "METR and Redwood performed an independent investigation with host-controlled data access, not an unrestricted forensic audit.",
      "OpenAI retained non-public-information redaction authority, provided feedback, and supplied API credits to the independent review; METR reports taking no payment.",
      "OpenAI's impact, chronology, and remediation statements remain company-reported, and its preliminary harness evaluations lack public sample sizes, intervals, and independent replication.",
      "The 14 Hugging Face credentials, 41 Hugging Face workers, and 956 OpenAI cloud-hosted secrets are separate company-reported units and stages.",
      "The July 5 entry is an OpenAI-attributed alert and response event, not an independently verified effectiveness finding.",
      "The 100-agent motive tags are non-exclusive, AI-assisted, not carefully iterated by METR, and do not generalize to all agents.",
      "Tool-call spoofing counts keep successful cases and evaluated transcripts as separate denominators.",
      "Source interpretations do not establish one settled motivation or behavior shared by all agents, models, or deployments.",
      "JFrog's statement and advisory index are vendor remediation records, not independent proof of incident scope or deployed patch coverage."
    ],
    "amends": null
  }
}
`,oe=new Set([`hire.html`,`overview.html`,`catalog.html`,`security.html`,`research.html`,`publications.html`,`writing.html`,`studio.html`,`gallery.html`,`retro.html`,`resume.html`,`cv.html`,`portfolio.html`,`person.html`]),se=[...b,...x.flatMap(e=>e.routes)].filter(e=>oe.has(e.href)&&C(e.href)),ce=JSON.parse(ae),le=ce.records.map(e=>w.find(t=>t.id===e.id&&t.systemId===e.systemId)).filter(e=>!!e),ue=ce.latestPublishedBriefing;function T(e){let t=ie(e);if(!t)throw Error(`Missing system record: ${e}`);return t}var E=ne,de=new Map(re.map(e=>[e.id,e])),fe=ie(`flywheel`);if(!fe)throw Error(`Missing system record: flywheel`);var D=fe,pe=w.filter(e=>e.status===`verified`),O=[`agent-systems`,`evaluation-verification`,`security-privacy`,`developer-infrastructure`,`graphics-media`,`research-education`],k=[`index`,`gather`,`buildlang`,`phantom`,`accountable-surface`],me=[`phantom`,`behavior-transform`,`accountable-surface`,`public-surface-sweeper`,`model-provenance-validator`,`secret-redact-io`,`agent-hook-pack`,`repo-proof-index`],he=[`raw`,`skyrimbridge`,`truth-enb`,`elder-enb`,`enb-runtime-core`,`studio-engine`,`retro-engine`,`engine-revival`,`brender-archival`].filter(e=>E.some(t=>t.id===e)),ge=[{label:`Technical support, developer operations, and QA`,href:`/hire.html#engineering-path`,summary:`Technical support engineering, developer operations, implementation, release support, and software QA.`},{label:`Evaluation tooling and Python developer tools`,href:`/hire.html#technical-operations-path`,summary:`Evaluation tooling, Python developer tools, test infrastructure, and research-engineering support.`},{label:`Public service, safety, and field operations`,href:`/hire.html#public-service-field-path`,summary:`Benefits-rich public routes where systems judgment and field reliability matter.`}];function _e(e){return e.startsWith(`http`)||e.startsWith(`/`)?e:`/${e}`}function ve(e){return e.evidence[0]?.href??e.sourceHref??_e(e.href)}function ye(e){return e.productType}function be(e){return e.slice(0,10)}var xe=k.map(T),Se=me.map(T),Ce=he.map(T),we=[{measure:String(E.length),label:`system records`,source:`site/systems.json`,href:`/catalog.html`,note:`purpose, boundary, maturity, and evidence fields`},{measure:String(E.filter(e=>e.placement===`featured`).length),label:`featured records`,source:`placement`,href:`/overview.html`,note:`systems promoted to the public front of the catalog`},{measure:String(pe.length),label:`verified evidence rows`,source:`evidence status`,href:`/catalog.html`,note:`release, source, paper, demo, or public-boundary records with dates`},{measure:D.evidence[0]?.date??`unknown`,label:`Flywheel release record`,source:`site/systems.json`,href:ve(D),note:`release label, source link, date, and limitations`},{measure:ue?.publishedAt??`not published`,label:`current briefing`,source:`site/publications.json`,href:ue?.href??`/publications.html`,note:ue?.title??`No verified briefing is published yet.`}];function Te(){return(0,f.useEffect)(()=>{let e=Array.from(document.querySelectorAll(`.reveal`));if(!(`IntersectionObserver`in window)){e.forEach(e=>e.classList.add(`in`));return}let t=new IntersectionObserver(e=>e.forEach(e=>{e.isIntersecting&&(e.target.classList.add(`in`),t.unobserve(e.target))}),{threshold:.12,rootMargin:`0px 0px -8% 0px`});e.forEach(e=>t.observe(e));let n=window.setTimeout(()=>e.forEach(e=>e.classList.add(`in`)),3e3);return()=>{t.disconnect(),window.clearTimeout(n)}},[]),(0,_.jsxs)(_.Fragment,{children:[(0,_.jsx)(v,{seed:74}),(0,_.jsx)(`div`,{className:`viewport-vignette`,"aria-hidden":`true`}),(0,_.jsx)(`a`,{className:`skip-link`,href:`#main`,children:`Skip to content`}),(0,_.jsx)(Ee,{}),(0,_.jsxs)(`main`,{id:`main`,children:[(0,_.jsx)(De,{}),(0,_.jsx)(Oe,{}),(0,_.jsx)(Ae,{}),(0,_.jsx)(Ie,{}),(0,_.jsx)(je,{}),(0,_.jsx)(Me,{}),(0,_.jsx)(Ne,{}),(0,_.jsx)(Pe,{}),(0,_.jsx)(Fe,{})]}),(0,_.jsx)(Le,{})]})}function Ee(){return(0,_.jsxs)(`nav`,{className:`topnav`,"aria-label":`Primary`,children:[(0,_.jsxs)(`a`,{className:`brand`,href:`#identity`,"aria-label":`Zain Dana Harper and Zentropy Labs home`,children:[(0,_.jsx)(`span`,{className:`brand-name`,children:`Zain Dana Harper`}),(0,_.jsx)(`span`,{className:`brand-lab`,children:`Zentropy Labs`})]}),(0,_.jsxs)(`div`,{className:`topnav-links`,children:[b.map(e=>(0,_.jsx)(`a`,{href:`/${e.href}`,children:e.label},e.href)),ee.map(e=>(0,_.jsx)(`a`,{href:e.href,rel:`noopener`,children:e.label},e.href))]}),(0,_.jsxs)(`details`,{className:`home-menu`,children:[(0,_.jsx)(`summary`,{children:`Menu`}),(0,_.jsxs)(`div`,{className:`home-menu-list`,"aria-label":`Primary menu`,children:[b.map(e=>(0,_.jsx)(`a`,{href:`/${e.href}`,children:e.label},e.href)),se.map(e=>(0,_.jsx)(`a`,{href:`/${e.href}`,children:e.label},e.href)),ee.map(e=>(0,_.jsx)(`a`,{href:e.href,rel:`noopener`,children:e.label},e.href))]})]})]})}function De(){return(0,_.jsxs)(`header`,{id:`identity`,className:`hero`,children:[(0,_.jsxs)(`div`,{className:`hero-copy reveal in`,children:[(0,_.jsx)(`h1`,{className:`hero-title`,children:`Zentropy Labs`}),(0,_.jsx)(`p`,{className:`hero-line`,children:`Product studio, systems engineering, graphics, security tooling, and public research.`}),(0,_.jsx)(`p`,{className:`hero-lab`,children:`Zain Dana Harper is the builder behind Zentropy Labs.`}),(0,_.jsxs)(`div`,{className:`hero-actions`,"aria-label":`Primary actions`,children:[(0,_.jsx)(`a`,{className:`btn solid`,href:`#products`,children:`Explore products`}),(0,_.jsx)(`a`,{className:`btn`,href:`/hire.html`,children:`Hire or collaborate`})]})]}),(0,_.jsx)(`figure`,{className:`identity-art reveal in`,children:(0,_.jsxs)(`picture`,{children:[(0,_.jsx)(`source`,{type:`image/webp`,srcSet:`/brand/zentropy-logo-640.webp 640w, /brand/zentropy-logo-960.webp 960w, /brand/zentropy-logo-1280.webp 1280w, /brand/zentropy-logo-1600.webp 1600w`,sizes:`(max-width: 900px) 92vw, 42vw`}),(0,_.jsx)(`img`,{src:`/brand/zentropy-logo.png`,alt:`Zentropy Labs aperture mark with cyan light and oxblood shadow`,width:`1600`,height:`900`,fetchPriority:`high`})]})})]})}function Oe(){return(0,_.jsxs)(`section`,{id:`products`,className:`section representative-section`,"aria-labelledby":`products-title`,children:[(0,_.jsxs)(`div`,{className:`section-heading`,children:[(0,_.jsx)(`h2`,{id:`products-title`,children:`Products to start with`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`Start with products that can be tried, inspected, or evaluated. Each entry says what the product does once, then gives its type, state, verification date, evidence, and full product page.`})]}),(0,_.jsx)(`div`,{className:`work-index`,children:xe.map(e=>(0,_.jsxs)(`article`,{className:`work-row`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h3`,{children:(0,_.jsx)(`a`,{href:_e(e.href),children:e.name})}),(0,_.jsx)(`p`,{children:e.purpose})]}),(0,_.jsx)(ke,{system:e})]},e.id))})]})}function ke({system:e}){return(0,_.jsxs)(`dl`,{children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Type`}),(0,_.jsx)(`dd`,{children:ye(e)})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`State`}),(0,_.jsx)(`dd`,{children:e.releaseState})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Verified`}),(0,_.jsx)(`dd`,{children:(0,_.jsx)(`time`,{dateTime:e.lastVerified,children:e.lastVerified})})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Evidence`}),(0,_.jsx)(`dd`,{children:(0,_.jsx)(`a`,{href:ve(e),children:e.evidence[0]?.label??e.maturity})})]})]})}function Ae(){let e=D.evidence[0];return(0,_.jsxs)(`section`,{id:`flywheel`,className:`section split-section`,"aria-labelledby":`flywheel-title`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h2`,{id:`flywheel-title`,children:`Featured platform: Flywheel`}),(0,_.jsx)(`p`,{className:`section-lead`,children:D.purpose}),(0,_.jsxs)(`div`,{className:`action-row`,children:[(0,_.jsx)(`a`,{className:`text-link`,href:_e(D.href),children:`Inspect Flywheel`}),D.sourceHref?(0,_.jsx)(`a`,{className:`text-link`,href:D.sourceHref,rel:`noopener`,children:`Source`}):null]})]}),(0,_.jsxs)(`div`,{className:`data-plate platform-record`,children:[(0,_.jsxs)(`table`,{className:`command-table`,children:[(0,_.jsx)(`caption`,{children:`Current Flywheel route`}),(0,_.jsxs)(`tbody`,{children:[(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`Type`}),(0,_.jsx)(`td`,{children:ye(D)})]}),(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`State`}),(0,_.jsx)(`td`,{children:D.releaseState})]}),(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`Release`}),(0,_.jsx)(`td`,{children:e?(0,_.jsx)(`a`,{href:e.href,children:e.label}):`No release record`})]}),(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`Verified`}),(0,_.jsx)(`td`,{children:e?.date??`unknown`})]}),(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`Install`}),(0,_.jsx)(`td`,{children:(0,_.jsx)(`code`,{children:D.entryCommand})})]}),(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`row`,children:`Check`}),(0,_.jsx)(`td`,{children:(0,_.jsx)(`code`,{children:D.verificationCommand})})]})]})]}),(0,_.jsx)(`p`,{className:`boundary-note`,children:D.limitations[0]})]})]})}function je(){return(0,_.jsxs)(`section`,{id:`evidence`,className:`section`,"aria-labelledby":`evidence-title`,children:[(0,_.jsxs)(`div`,{className:`section-heading`,children:[(0,_.jsx)(`h2`,{id:`evidence-title`,children:`Evidence board`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`A compact index of the public record. Values come from checked-in source data and link back to the record that produced them.`})]}),(0,_.jsxs)(`div`,{className:`data-plate evidence-board`,children:[(0,_.jsxs)(`table`,{className:`evidence-table`,children:[(0,_.jsx)(`caption`,{children:`Public evidence, current source snapshot`}),(0,_.jsx)(`thead`,{children:(0,_.jsxs)(`tr`,{children:[(0,_.jsx)(`th`,{scope:`col`,children:`Measure`}),(0,_.jsx)(`th`,{scope:`col`,children:`Record`}),(0,_.jsx)(`th`,{scope:`col`,children:`Source`}),(0,_.jsx)(`th`,{scope:`col`,children:`Boundary`})]})}),(0,_.jsx)(`tbody`,{children:we.map(e=>(0,_.jsxs)(`tr`,{"data-evidence-row":!0,children:[(0,_.jsx)(`th`,{scope:`row`,children:(0,_.jsx)(`a`,{href:e.href,children:e.measure})}),(0,_.jsx)(`td`,{children:e.label}),(0,_.jsx)(`td`,{children:e.source}),(0,_.jsx)(`td`,{children:e.note})]},e.label))})]}),(0,_.jsxs)(`p`,{className:`does-not-prove`,children:[(0,_.jsx)(`strong`,{children:`What this does not prove:`}),` A valid release row is not an adoption claim, safety claim, or guarantee of model correctness. Counts and releases stay evidence rows, not market proof.`]}),(0,_.jsxs)(`section`,{className:`evidence-current`,"aria-labelledby":`current-evidence-title`,children:[(0,_.jsx)(`h3`,{id:`current-evidence-title`,children:`Newest registry evidence`}),(0,_.jsx)(`ol`,{children:le.map(e=>(0,_.jsxs)(`li`,{children:[(0,_.jsx)(`time`,{dateTime:e.date,children:e.date}),(0,_.jsx)(`a`,{href:e.href,rel:`noopener`,children:e.label}),(0,_.jsx)(`span`,{children:e.summary})]},`${e.systemId}:${e.id}`))})]})]})]})}function Me(){return(0,_.jsxs)(`section`,{id:`evidence-figures`,className:`section evidence-figures-section`,"aria-labelledby":`figures-title`,children:[(0,_.jsxs)(`div`,{className:`section-heading`,children:[(0,_.jsx)(`h2`,{id:`figures-title`,children:`Measured evidence`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`Source-attributed figures publish units, denominators, dates, provenance, and limits. Capability families remain navigation labels, not diagrams or product hierarchies.`})]}),(0,_.jsxs)(`div`,{className:`evidence-figure-grid`,children:[(0,_.jsxs)(`article`,{className:`evidence-figure-card`,"data-evidence-figure-card":!0,children:[(0,_.jsx)(`h3`,{children:`164-task model pass@1 comparison`}),(0,_.jsx)(`a`,{href:`/analytics/model-pass-at-1-comparison.html`,children:(0,_.jsx)(`img`,{className:`research-figure-image`,src:`/analytics/model-pass-at-1-comparison.svg`,alt:`Paired 164-task pass-at-one result: base Qwen 14B passed 141 tasks and Flywheel 14B passed 136; the difference was not statistically significant.`,width:`1120`,height:`334`,loading:`lazy`})}),(0,_.jsx)(`p`,{children:`Same task set and harness. This measures two model artifacts, not market superiority or general agent reliability.`})]}),(0,_.jsxs)(`article`,{className:`evidence-figure-card`,"data-evidence-figure-card":!0,children:[(0,_.jsx)(`h3`,{children:`Current cross-harness pilot`}),(0,_.jsx)(`a`,{href:`/analytics/current-cross-harness-pilot.html`,children:(0,_.jsx)(`img`,{className:`research-figure-image`,src:`/analytics/current-cross-harness-pilot.svg`,alt:`Four receipt-verified cross-harness attempts with zero valid comparable task outcomes.`,width:`1120`,height:`480`,loading:`lazy`})}),(0,_.jsx)(`p`,{children:`4/4 receipts verified, but no valid comparable task outcome. The durations are diagnostic only.`})]}),(0,_.jsxs)(`article`,{className:`evidence-figure-card`,"data-evidence-figure-card":!0,children:[(0,_.jsx)(`h3`,{children:`Recovered actions by day`}),(0,_.jsx)(`img`,{className:`research-figure-image`,src:`/figures/recovered-actions-by-day.svg`,alt:`Bar chart of five recovered-action counts from July 9 through July 13, 2026: 3,779; 1,135; 7,677; 3,892; and 1,130.`,width:`1280`,height:`720`,loading:`lazy`}),(0,_.jsx)(`p`,{children:`Five daily counts from Hugging Face host telemetry. Unit: recovered logged actions. The figure does not measure unique attacks, severity, intent, or harm.`}),(0,_.jsx)(`p`,{children:(0,_.jsx)(`a`,{href:`/figures/recovered-actions-by-day.json`,children:`Read the dataset and provenance`})})]}),(0,_.jsxs)(`article`,{className:`evidence-figure-card`,"data-evidence-figure-card":!0,children:[(0,_.jsx)(`h3`,{children:`Reported motive labels`}),(0,_.jsx)(`img`,{className:`research-figure-image`,src:`/figures/motive-sample-nonexclusive.svg`,alt:`Bar chart of non-exclusive motive labels in a 100-agent sample: scorer source or access 97, shared infrastructure or credentials 66, and task solution or private trajectories 89.`,width:`1280`,height:`720`,loading:`lazy`}),(0,_.jsx)(`p`,{children:`Non-exclusive labels from the independent investigator sample. Categories overlap, so counts must not be summed into a population total.`}),(0,_.jsx)(`p`,{children:(0,_.jsx)(`a`,{href:`/figures/motive-sample-nonexclusive.json`,children:`Read the dataset and provenance`})})]})]}),(0,_.jsxs)(`div`,{className:`family-browser`,children:[(0,_.jsx)(`h3`,{children:`Browse the work by primary subject`}),(0,_.jsx)(`p`,{children:`These are navigation labels only. Every catalog record retains its own purpose, product type, maturity, source, and limitations.`}),(0,_.jsx)(`div`,{className:`family-index`,children:O.map(e=>{let t=de.get(e),n=E.filter(t=>t.domains.includes(e));return(0,_.jsxs)(`article`,{className:`family-row`,"data-family-row":!0,children:[(0,_.jsx)(`h3`,{children:t?.label??e}),(0,_.jsx)(`p`,{children:t?.summary}),(0,_.jsxs)(`a`,{href:`/catalog.html#domain-${e}`,children:[n.length,` related records`]})]},e)})})]})]})}function Ne(){return(0,_.jsxs)(`section`,{id:`research`,className:`section split-section`,"aria-labelledby":`research-title`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h2`,{id:`research-title`,children:`Current research`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`The publication surface carries current briefings, figures, source records, limitations, and related reproducible artifacts for public review.`}),(0,_.jsxs)(`div`,{className:`action-row`,children:[(0,_.jsx)(`a`,{className:`text-link`,href:`/publications.html`,children:`Publication index`}),(0,_.jsx)(`a`,{className:`text-link`,href:`/figures/recovered-actions-by-day.html`,children:`Measured figures`})]})]}),ue?(0,_.jsxs)(`article`,{className:`data-plate briefing-card`,children:[(0,_.jsx)(`h3`,{children:(0,_.jsx)(`a`,{href:ue.href,"data-current-briefing-title":!0,children:ue.title})}),(0,_.jsxs)(`p`,{children:[ue.sourceCount,` public sources. Limitations remain attached to the record.`]}),(0,_.jsxs)(`dl`,{className:`briefing-meta`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Published`}),(0,_.jsx)(`dd`,{children:be(ue.publishedAt)})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Primary figure`}),(0,_.jsx)(`dd`,{children:(0,_.jsx)(`a`,{href:ue.primaryFigureHref,children:`Open figure`})})]})]})]}):null]})}function Pe(){return(0,_.jsxs)(`section`,{id:`retro-systems-lab`,className:`section retro-section`,"aria-labelledby":`retro-title`,children:[(0,_.jsxs)(`div`,{className:`section-heading`,children:[(0,_.jsx)(`h2`,{id:`retro-title`,children:`Graphics, engines, and preservation`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`Rendering platforms, Skyrim runtime integration, shader suites, browser graphics, procedural media, and software preservation are shown as separate products. Source state, releases, tests, and limitations remain attached to each project.`})]}),(0,_.jsx)(`div`,{className:`retro-flow`,children:Ce.map(e=>(0,_.jsxs)(`article`,{className:`retro-step`,children:[(0,_.jsx)(`span`,{className:`retro-verb`,children:e.accessMode}),(0,_.jsx)(`h3`,{children:(0,_.jsx)(`a`,{href:_e(e.href),children:e.name})}),(0,_.jsx)(`p`,{children:e.purpose}),(0,_.jsxs)(`dl`,{className:`product-meta`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Type`}),(0,_.jsx)(`dd`,{children:ye(e)})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`State`}),(0,_.jsx)(`dd`,{children:e.releaseState})]}),(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`dt`,{children:`Evidence`}),(0,_.jsx)(`dd`,{children:(0,_.jsx)(`a`,{href:ve(e),children:e.evidence[0]?.label??e.maturity})})]})]})]},e.id))}),(0,_.jsx)(`p`,{className:`boundary-note`,children:`Shared subject matter does not imply one parent product, a runtime dependency, or inherited evidence.`})]})}function Fe(){return(0,_.jsxs)(`section`,{id:`security-boundary`,className:`section security-section`,"aria-labelledby":`security-title`,children:[(0,_.jsxs)(`div`,{className:`section-heading`,children:[(0,_.jsx)(`h2`,{id:`security-title`,children:`Security boundary`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`Public pages describe what the security products do and direct qualified work to a controlled intake.`})]}),(0,_.jsxs)(`div`,{className:`security-layout`,children:[(0,_.jsxs)(`article`,{className:`data-plate boundary-card`,children:[(0,_.jsx)(`h3`,{children:`Public route, private authority`}),(0,_.jsx)(`p`,{children:`No private repository, operational method, target detail, client fact, or engagement result is published. Written authorization, defined scope, secure intake, and review are required before private capability is discussed or used.`}),(0,_.jsx)(`a`,{className:`text-link`,href:`/private-practice.html`,children:`Private recipient lane`})]}),(0,_.jsx)(`ol`,{className:`security-list`,children:Se.map(e=>(0,_.jsxs)(`li`,{children:[(0,_.jsx)(`a`,{href:_e(e.href),children:e.name}),(0,_.jsxs)(`span`,{children:[e.accessMode,` / `,e.maturity]})]},e.id))})]})]})}function Ie(){return(0,_.jsxs)(`section`,{id:`hiring-collaboration`,className:`section hiring-section`,"aria-labelledby":`hiring-title`,children:[(0,_.jsxs)(`div`,{children:[(0,_.jsx)(`h2`,{id:`hiring-title`,children:`Hiring, contracting, and collaboration`}),(0,_.jsx)(`p`,{className:`section-lead`,children:`Run, inspect, or verify the work through three practical routes: technical support and QA, evaluation tooling and Python developer tools, and public-service or field work. The documents are direct, and the project evidence stays one click away.`})]}),(0,_.jsxs)(`div`,{className:`hiring-actions`,children:[ge.map(e=>(0,_.jsx)(`a`,{className:`btn`,href:e.href,children:(0,_.jsx)(`span`,{children:e.label})},e.href)),(0,_.jsx)(`a`,{className:`btn solid`,href:`/hire.html`,children:`Hiring map`}),(0,_.jsx)(`a`,{className:`btn`,href:`/resume.html`,children:`Technical resume`}),(0,_.jsx)(`a`,{className:`btn`,href:`/cv.html`,children:`CV`}),(0,_.jsx)(`a`,{className:`btn`,href:`/portfolio.html`,children:`Portfolio`}),(0,_.jsx)(`a`,{className:`btn`,href:`mailto:zaindharper@gmail.com`,children:`Email`}),(0,_.jsx)(`a`,{className:`btn`,href:`https://github.com/HarperZ9`,rel:`noopener`,children:`GitHub`})]})]})}function Le(){return(0,_.jsxs)(`footer`,{className:`site-footer`,children:[(0,_.jsx)(`p`,{children:`Zain Dana Harper and Zentropy Labs. Public systems, research briefings, retro rendering, security tooling, and hiring routes.`}),(0,_.jsxs)(`nav`,{className:`footer-links`,"aria-label":`Footer`,children:[se.map(e=>(0,_.jsx)(`a`,{href:`/${e.href}`,children:e.label},e.href)),(0,_.jsx)(`a`,{href:`https://github.com/HarperZ9`,rel:`noopener`,children:`GitHub`})]})]})}(0,p.createRoot)(document.getElementById(`root`)).render((0,_.jsx)(f.StrictMode,{children:(0,_.jsx)(Te,{})}));