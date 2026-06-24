type Resolver = (password: string | null) => void;

interface Request {
  message: string;
  resolve: Resolver;
}

type Listener = (req: Request) => void;

let _listener: Listener | null = null;
let _pending: Request | null = null;

export const adminPasswordEmitter = {
  request(message: string, resolve: Resolver) {
    const req: Request = { message, resolve };
    if (_listener) {
      _listener(req);
    } else {
      _pending = req;
    }
  },

  subscribe(fn: Listener) {
    _listener = fn;
    if (_pending) {
      fn(_pending);
      _pending = null;
    }
    return () => {
      if (_listener === fn) _listener = null;
    };
  },
};
