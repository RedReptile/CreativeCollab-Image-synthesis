const React = require("react");

const MemoryRouter = ({ children }) => <div>{children}</div>;
const BrowserRouter = MemoryRouter;

const Link = ({ to, children, ...rest }) => (
  <a href={typeof to === "string" ? to : "#"} {...rest}>
    {children}
  </a>
);

const useNavigate = () => jest.fn();
const useParams = () => ({});

const Route = ({ element }) => element || null;
const Routes = ({ children }) => <div>{children}</div>;

module.exports = {
  MemoryRouter,
  BrowserRouter,
  Link,
  useNavigate,
  useParams,
  Route,
  Routes,
};

