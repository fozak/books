export function setDarkMode(darkMode) {
    if (darkMode) {
        document.documentElement.classList.add('dark', 'custom-scroll', 'custom-scroll-thumb1');
        return;
    }
    document.documentElement.classList.remove('dark');
}
//# sourceMappingURL=theme.js.map