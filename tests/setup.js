// jsdom provides customElements, HTMLElement and CustomEvent; only fetch is mocked.
beforeEach(() => {
  global.fetch = jest.fn();
});
