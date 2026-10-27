import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  onError: (error: Error) => void;
  fallback: ReactNode;
  children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[buscador-puntos] error en un componente:", error, info.componentStack);
    this.props.onError(error);
  }

  render() {
    return this.state.fallo ? this.props.fallback : this.props.children;
  }
}
