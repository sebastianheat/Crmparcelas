type ClassValue = string | false | null | undefined;

/** Une clases condicionalmente (mini-clsx). */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
