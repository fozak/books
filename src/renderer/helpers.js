const instanceMap = new Map();
export const outsideClickDirective = {
    beforeMount(el, binding) {
        const clickHandler = function (e) {
            onDocumentClick(e, el, binding.value);
        };
        removeHandlerIfPresent(el);
        instanceMap.set(el, clickHandler);
        document.addEventListener('click', clickHandler);
    },
    unmounted(el) {
        removeHandlerIfPresent(el);
    },
};
function onDocumentClick(e, el, fn) {
    const target = e.target;
    if (el !== target && !el.contains(target)) {
        fn?.(e);
    }
}
function removeHandlerIfPresent(el) {
    const clickHandler = instanceMap.get(el);
    if (!clickHandler) {
        return;
    }
    instanceMap.delete(el);
    document.removeEventListener('click', clickHandler);
}
//# sourceMappingURL=helpers.js.map