import { createElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type PropsWithChildren } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", type = "button", ...rest } = props;
  return createElement("button", { type, className: `ui-button ${className}`.trim(), ...rest });
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return createElement("input", { className: `ui-input ${className}`.trim(), ...rest });
}

export function Card({ className = "", children }: PropsWithChildren<{ className?: string }>) {
  return createElement("div", { className: `ui-card ${className}`.trim() }, children);
}
