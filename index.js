// definition de la classe des emitters
const sayHelloOnClick = () => {
  console.log("hello, World");
};

const handleToggleTheme = (root) => () => {
  root.classList.toggle("dark");
  root.classList.toggle("white");
};

let textGenerated = [];

const genRandomText = (size) => {
  let length = 4;
  if (size && !isNaN(size) && size > 0) length = size;
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let cantPass = true;
  let triesCount = 0;
  const maxTriesCount = Math.pow(26, size);
  do {
    text = "";
    for (let i = 0; i < length; i++) {
      text += possible[Math.floor(Math.random() * possible.length)];
    }
    if (textGenerated.includes(text)) cantPass = true;
    else cantPass = false;
  } while (cantPass && triesCount < maxTriesCount);
  if (textGenerated.includes(text)) {
    throw Error("Plus aucune combinaison possible pour la taille " + size);
  }
  textGenerated.push(text);
  return text;
};

class Emitter {
  _state = {};

  _callbacks = {};

  _stateProxy = new Proxy(this._state, {
    set: (target, property, newValue) => {
      target[property] = newValue;
      this._callbacks[property]?.forEach((callback) => callback(newValue));
      return true;
    },
  });

  on(eventName, callback) {
    if (Array.isArray(this._callbacks[eventName])) {
      this._callbacks[eventName].push(callback);
    } else {
      this._callbacks[eventName] = [callback];
    }
  }

  emit(eventName, data) {
    this._stateProxy[eventName] = data;
  }
}

const globalEmitter = new Emitter();

// definition de l'etat de l'application
class ApplicationState {
  _state = {};
  _stateProxy = new Proxy(this._state, {
    set: (target, property, newValue) => {
      target[property] = newValue;
      this.emitter.emit("STATE_CHANGED", this._state);
      return true;
    },
  });
  constructor(emitter) {
    this.emitter = emitter;
  }
}

class IComponent {
  _state = {};
  render = () => "";
}

class Component extends IComponent {
  constructor(props, render) {
    super();
    this.props = props;
    this.render = render;
  }
}

class TitleComponnent extends IComponent {
  constructor(props) {
    super();
    this.props = props;
  }
  render = (props) => {
    this.props = { ...this.props, ...props };
    return `<h1>${this.props.text}</h1>`;
  };
}

class ButtonComponent extends IComponent {
  constructor(props) {
    super();
    console.log("props", props);
    this.props = props;
    this.props.label = this.props.label || "Click Me";
    this.props.eventListners = this.props.eventListners || [
      {
        name: "click",
        handler: sayHelloOnClick,
      },
    ];
    this.props.id = this.props.id || genRandomText(4);
  }
  onStart = (props) => {
    this.props = { ...this.props, ...props };
    if (this.props.eventListners) {
      this.props.eventListners.forEach((event) => {
        this.props.emitter.emit("ADD_EVENT_LISTENER", [
          this.props.id,
          event.name,
          event.handler,
        ]);
      });
    }
  };
  render = (props) => {
    this.onStart(props);
    return `<button id="${this.props.id}">${this.props.label}</button>`;
  };
}

class EventManager {
  _state = [];

  constructor(emitter) {
    const scriptId = genRandomText(4);
    this.emitter = emitter;
    this.emitter.on("ADD_EVENT_LISTENER", ([elementId, eventName, handler]) => {
      this.addEventListner(elementId, eventName, handler);
    });

    const scriptElementToAdd = document.createElement("script");
    scriptElementToAdd.id = scriptId;
    this.scriptElement = scriptElementToAdd;
  }

  addEventListner(elementId, eventName, handler) {
    this._state.push({ elementId, eventName, handler });
  }
  removeEventListner(elementId, eventName, handler) {
    // TODO - implement remove listener
  }

  refreshScripts() {
    textGenerated = textGenerated.filter(
      (text) => text !== this.scriptElement.id
    );
    try {
      document.body.removeChild(this.scriptElement);
    } catch (err) {
      console.error("no script tag founded");
    }

    this.scriptElement.innerHTML = ``;
    this.scriptElement.remove();

    const newScript = document.createElement("script");

    const text = this._state
      .map((event) => {
        console.log("event", event);
        const variableName = genRandomText(4);
        return `

        // ==========================================================================
        // gestion de l'evenement ${event.eventName} sur l'element ${
          event.elementId
        }

        const element${variableName} = document.getElementById("${
          event.elementId
        }");
        element${variableName}?.addEventListener("${
          event.eventName
        }", ${event.handler.toString()});

        // fin gestion de l'evenement ${event.eventName} sur l'element ${
          event.elementId
        }
        // ==========================================================================

    `;
      })
      .join("");

    const inlineScript = document.createTextNode(text);
    newScript.appendChild(inlineScript);
    document.body.appendChild(newScript);
    newScript.id = genRandomText(4);
    this.scriptElement = newScript;
  }

  //   removeEventListner(eventid)
}

// definition des routeurs
class Router extends IComponent {
  _location = {
    path: "",
    url: "",
  };
  _locationProxy = new Proxy(this._location, {
    set: (target, property, newValue) => {
      console.log("target", target, property, newValue);
      target[property] = newValue;
      this.emitter.emit("ROUTE_CHANGED", this._location.path);
      console.log("target", target, property, newValue);
      return true;
    },
  });
  navigateTo(path) {
    window.history.pushState(null, null, path);
    this._location = {
      path: window.location.pathname,
      url: window.location.href,
    };
    this.emitter.emit("ROUTE_CHANGED", this._location.path);
    console.log("navigateTo", path);
    console.log("location", this._location);
  }
  constructor(emitter, componentTrees) {
    super();
    this._location = {
      path: window.location.pathname,
      url: window.location.href,
    };
    this.emitter = emitter;
    this.componentTrees = componentTrees;
    globalEmitter.on("NAVIGATE_TO", (path) => {
      this.navigateTo(path);
    });
  }

  render = () => {
    console.log("location", this._location);
    return this.componentTrees[this._location.path]
      ?.map((componentObj) =>
        componentObj.component.render({
          ...componentObj.props,
          router: this,
          emitter: this.emitter,
        })
      )
      .join("");
  };
}

class Application {
  constructor(root, componentsTrees) {
    this.root = root;
    this.emitter = new Emitter();
    this.componentsTrees = componentsTrees;
    this.state = new ApplicationState(this.emitter);
    this.router = new Router(this.emitter, componentsTrees);
    this.eventManager = new EventManager(this.emitter);

    this.emitter.on("APP_RERENDER", () => this.render());
    this.emitter.on("ROUTE_CHANGED", (path) => {
      this.render();
      //   setTimeout(() => {
      //     window.history.pushState(null, null, path);
      //   }, 200);
    });
  }

  rerender() {
    console.log("App rerendering");
    this.root.innerHTML = this.router.render();
  }

  render() {
    console.log("App rendering");
    this.root.innerHTML = this.router.render();

    setTimeout(() => {
      this.eventManager.refreshScripts();
    }, 200);
  }
}

const main = async () => {
  const root = document.querySelector("#root");
  const componentsTrees = {
    "/index.html": [
      {
        component: new TitleComponnent({
          text: "Hello World",
        }),
        props: {
          text: "Hello World",
        },
      },
      {
        component: new ButtonComponent({}),
        props: {
          eventListners: [
            {
              name: "click",
              handler: handleToggleTheme(root),
            },
          ],
        },
      },
      {
        component: new ButtonComponent({
          eventListners: [
            {
              name: "click",
              handler: () => {
                globalEmitter.emit("NAVIGATE_TO", "/index.html/anotherPage");
              },
            },
          ],
        }),
        props: {
          label: "Go to another page",
        },
      },
    ],
    "/index.html/anotherPage": [
      {
        component: new TitleComponnent({
          text: "another Page",
        }),
        props: {
          text: "another Page",
        },
      },
      {
        component: new ButtonComponent({}),
        props: {
          eventListners: [
            {
              name: "click",
              handler: handleToggleTheme(root),
            },
          ],
        },
      },
      {
        component: new ButtonComponent({
          eventListners: [
            {
              name: "click",
              handler: () => {
                globalEmitter.emit("NAVIGATE_TO", "/index.html");
              },
            },
          ],
        }),
        props: {
          label: "Back",
        },
      },
    ],
  };
  const app = new Application(root, componentsTrees);
  app.render();
};

main();
