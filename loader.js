(function () {
    'use strict';

    /*
     * 367 Easter Eggs Loader
     *
     * On page load:
     *   1. Load manifest.json.
     *   2. Install the triggers listed in the manifest.
     *   3. Wait.
     *
     * When a trigger fires:
     *   1. Load that game's script.
     *   2. Wait for the game to register itself.
     *   3. Call the game's launch() function.
     */

    if (window.EasterEggs) {
        console.warn('EasterEggs has already been initialized.');
        return;
    }

    /*
     * Find the directory containing this loader.
     *
     * For example, when loader.js is loaded from:
     *
     * https://user.github.io/367-Easter-Eggs-Deploy/loader.js
     *
     * BASE_URL becomes:
     *
     * https://user.github.io/367-Easter-Eggs-Deploy/
     */
    const loaderScript = document.currentScript;

    if (!loaderScript || !loaderScript.src) {
        console.error(
            'EasterEggs could not determine the location of loader.js.'
        );
        return;
    }

    const LOADER_URL = new URL(
        loaderScript.src,
        window.location.href
    );

    const BASE_URL = new URL('./', LOADER_URL);
    const MANIFEST_URL = new URL('manifest.json', BASE_URL);

    /*
     * Internal state
     */

    let manifest = null;
    let initializationPromise = null;

    /*
     * Games that have called EasterEggs.register().
     */
    const registeredGames = new Map();

    /*
     * Games whose scripts are currently downloading.
     *
     * Keeping the loading Promise prevents the same game from being
     * downloaded more than once when multiple launch requests happen
     * close together.
     */
    const loadingGames = new Map();

    /*
     * Cleanup functions returned by trigger installers.
     */
    const triggerCleanupFunctions = [];

    /*
     * Utility functions
     */

    function resolveRepositoryURL(path) {
        return new URL(path, BASE_URL).href;
    }

    function normalizeKey(key, caseSensitive) {
        if (
            caseSensitive ||
            typeof key !== 'string' ||
            key.length !== 1
        ) {
            return key;
        }

        return key.toLowerCase();
    }

    function safelyLaunch(gameId) {
        window.EasterEggs.launch(gameId).catch(error => {
            console.error(
                `Easter egg "${gameId}" could not be launched.`,
                error
            );
        });
    }

    /*
     * Manifest handling
     */

    async function loadManifest() {
        const response = await fetch(MANIFEST_URL.href, {
            /*
             * The browser may keep a cached copy, but it must check
             * whether a newer manifest is available.
             */
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(
                `Could not load manifest.json: ` +
                `${response.status} ${response.statusText}`
            );
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(
                'manifest.json does not contain valid JSON.',
                {
                    cause: error
                }
            );
        }

        validateManifest(data);

        return data;
    }

    function validateManifest(data) {
        if (!data || typeof data !== 'object') {
            throw new TypeError(
                'The Easter egg manifest must be a JSON object.'
            );
        }

        if (!Array.isArray(data.games)) {
            throw new TypeError(
                'The manifest must contain a "games" array.'
            );
        }

        const knownIds = new Set();

        data.games.forEach((game, index) => {
            if (!game || typeof game !== 'object') {
                throw new TypeError(
                    `Game entry ${index} must be an object.`
                );
            }

            if (!game.id || typeof game.id !== 'string') {
                throw new TypeError(
                    `Game entry ${index} must have a string "id".`
                );
            }

            if (knownIds.has(game.id)) {
                throw new Error(
                    `The manifest contains duplicate game ID ` +
                    `"${game.id}".`
                );
            }

            knownIds.add(game.id);

            if (!game.script || typeof game.script !== 'string') {
                throw new TypeError(
                    `Game "${game.id}" must have a string "script".`
                );
            }

            if (
                game.triggers !== undefined &&
                !Array.isArray(game.triggers)
            ) {
                throw new TypeError(
                    `The "triggers" property for "${game.id}" ` +
                    'must be an array.'
                );
            }
        });
    }

    function findGame(gameId) {
        if (!manifest) {
            throw new Error(
                'The Easter egg manifest has not finished loading.'
            );
        }

        const game = manifest.games.find(entry => {
            return entry.id === gameId;
        });

        if (!game) {
            throw new Error(
                `No Easter egg with ID "${gameId}" exists ` +
                'in manifest.json.'
            );
        }

        return game;
    }

    /*
     * Game registration and loading
     */

    function registerGame(gameId, plugin) {
        if (!gameId || typeof gameId !== 'string') {
            throw new TypeError(
                'An Easter egg must register with a string ID.'
            );
        }

        if (!plugin || typeof plugin !== 'object') {
            throw new TypeError(
                `Easter egg "${gameId}" must register an object.`
            );
        }

        if (typeof plugin.launch !== 'function') {
            throw new TypeError(
                `Easter egg "${gameId}" must provide launch().`
            );
        }

        if (registeredGames.has(gameId)) {
            console.warn(
                `Easter egg "${gameId}" is already registered.`
            );

            return registeredGames.get(gameId);
        }

        registeredGames.set(gameId, plugin);

        console.log(`Registered Easter egg: ${gameId}`);

        return plugin;
    }

    function injectGameScript(gameId, scriptPath) {
        const scriptURL = resolveRepositoryURL(scriptPath);

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = scriptURL;
            script.async = true;
            script.dataset.easterEggGame = gameId;

            script.addEventListener(
                'load',
                () => {
                    const plugin = registeredGames.get(gameId);

                    if (!plugin) {
                        reject(
                            new Error(
                                `The script for "${gameId}" loaded, ` +
                                'but the game did not register itself.'
                            )
                        );

                        return;
                    }

                    resolve(plugin);
                },
                {
                    once: true
                }
            );

            script.addEventListener(
                'error',
                () => {
                    reject(
                        new Error(
                            `Could not load the script for ` +
                            `"${gameId}": ${scriptURL}`
                        )
                    );
                },
                {
                    once: true
                }
            );

            document.head.appendChild(script);
        });
    }

    async function loadGame(gameId) {
        /*
         * The game has already loaded and registered.
         */
        if (registeredGames.has(gameId)) {
            return registeredGames.get(gameId);
        }

        /*
         * The game is already being downloaded.
         */
        if (loadingGames.has(gameId)) {
            return loadingGames.get(gameId);
        }

        const gameConfig = findGame(gameId);

        const loadingPromise = injectGameScript(
            gameId,
            gameConfig.script
        );

        loadingGames.set(gameId, loadingPromise);

        try {
            return await loadingPromise;
        } catch (error) {
            /*
             * Allow a future launch attempt to try downloading the
             * script again after a failed request.
             */
            loadingGames.delete(gameId);
            throw error;
        }
    }

    async function launchGame(gameId, options = {}) {
        await initialize();

        const plugin = await loadGame(gameId);

        return plugin.launch(options);
    }

    function stopGame(gameId) {
        const plugin = registeredGames.get(gameId);

        if (!plugin) {
            return;
        }

        if (typeof plugin.stop === 'function') {
            return plugin.stop();
        }
    }

    /*
     * Trigger installers
     */

    function installSequenceTrigger(gameId, trigger) {
        if (
            !Array.isArray(trigger.sequence) ||
            trigger.sequence.length === 0
        ) {
            throw new TypeError(
                `The sequence trigger for "${gameId}" ` +
                'must contain a nonempty "sequence" array.'
            );
        }

        const eventType = trigger.event || 'keyup';
        const caseSensitive = Boolean(trigger.caseSensitive);
        const preventDefault = Boolean(trigger.preventDefault);

        const sequence = trigger.sequence.map(key => {
            return normalizeKey(key, caseSensitive);
        });

        let position = 0;

        function handleKeyEvent(event) {
            const enteredKey = normalizeKey(
                event.key,
                caseSensitive
            );

            const expectedKey = sequence[position];

            if (enteredKey === expectedKey) {
                if (preventDefault) {
                    event.preventDefault();
                }

                position += 1;

                if (position === sequence.length) {
                    position = 0;
                    safelyLaunch(gameId);
                }

                return;
            }

            /*
             * When the incorrect key is also the first key in the
             * sequence, immediately start a new attempt.
             */
            position = enteredKey === sequence[0] ? 1 : 0;
        }

        document.addEventListener(
            eventType,
            handleKeyEvent
        );

        return function removeSequenceTrigger() {
            document.removeEventListener(
                eventType,
                handleKeyEvent
            );
        };
    }

    function installKonamiTrigger(gameId, trigger) {
        return installSequenceTrigger(
            gameId,
            {
                ...trigger,

                sequence: [
                    'ArrowUp',
                    'ArrowUp',
                    'ArrowDown',
                    'ArrowDown',
                    'ArrowLeft',
                    'ArrowRight',
                    'ArrowLeft',
                    'ArrowRight',
                    'b',
                    'a'
                ]
            }
        );
    }

    /*
     * Additional trigger types can be added here later.
     *
     * For example:
     *
     * typed: installTypedTrigger
     * click: installClickTrigger
     */
    const triggerInstallers = {
        konami: installKonamiTrigger,
        sequence: installSequenceTrigger
    };

    function installTrigger(gameId, trigger) {
        if (!trigger || typeof trigger !== 'object') {
            console.warn(
                `Ignoring an invalid trigger for "${gameId}".`
            );
            return;
        }

        const installer = triggerInstallers[trigger.type];

        if (!installer) {
            console.warn(
                `Ignoring unsupported trigger type ` +
                `"${trigger.type}" for "${gameId}".`
            );
            return;
        }

        try {
            const cleanup = installer(gameId, trigger);

            if (typeof cleanup === 'function') {
                triggerCleanupFunctions.push(cleanup);
            }
        } catch (error) {
            console.error(
                `Could not install trigger for "${gameId}".`,
                error
            );
        }
    }

    function installManifestTriggers() {
        manifest.games.forEach(game => {
            const triggers = game.triggers || [];

            triggers.forEach(trigger => {
                installTrigger(game.id, trigger);
            });
        });
    }

    /*
     * Initialization
     */

    async function initialize() {
        /*
         * Reuse the same Promise when initialization is already running
         * or has completed.
         */
        if (initializationPromise) {
            return initializationPromise;
        }

        initializationPromise = (async () => {
            manifest = await loadManifest();

            installManifestTriggers();

            console.log(
                `EasterEggs initialized with ` +
                `${manifest.games.length} configured game(s).`
            );

            return window.EasterEggs;
        })();

        try {
            return await initializationPromise;
        } catch (error) {
            /*
             * Reset this so initialization can be attempted again.
             */
            initializationPromise = null;

            console.error(
                'Could not initialize the Easter egg system.',
                error
            );

            throw error;
        }
    }

    /*
     * Public API
     */

    window.EasterEggs = Object.freeze({
        register: registerGame,

        initialize,

        load: async function (gameId) {
            await initialize();
            return loadGame(gameId);
        },

        launch: launchGame,

        stop: stopGame,

        stopAll: function () {
            registeredGames.forEach(plugin => {
                if (typeof plugin.stop === 'function') {
                    plugin.stop();
                }
            });
        },

        isLoaded: function (gameId) {
            return registeredGames.has(gameId);
        },

        getLoaded: function () {
            return Array.from(registeredGames.keys());
        },

        getManifest: function () {
            if (!manifest) {
                return null;
            }

            /*
             * Return a copy so outside code cannot accidentally modify
             * the loader's internal manifest.
             */
            return JSON.parse(JSON.stringify(manifest));
        },

        getBaseURL: function () {
            return BASE_URL.href;
        },

        destroyTriggers: function () {
            triggerCleanupFunctions.forEach(cleanup => {
                cleanup();
            });

            triggerCleanupFunctions.length = 0;
        }
    });

    /*
     * Start automatically. Wix only needs to load loader.js.
     */
    initialize().catch(() => {
        /*
         * initialize() already logs the detailed error.
         * This catch prevents an unhandled Promise rejection.
         */
    });
})();