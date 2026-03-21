# Getting Started with TypeScript

TypeScript adds static typing to JavaScript, helping you catch errors early and write more maintainable code. Let's look at some basic examples to get you started with the language.

## Basic Types

TypeScript supports several primitive types that you'll use frequently in your code. Here's a quick overview of the most common ones you need to know about.

```typescript
const name: string = "Alice";
const age: number = 30;
const active: boolean = true;
const items: string[] = ["a", "b", "c"];
```

## Interfaces

Interfaces define the shape of objects, providing a powerful way to create contracts within your code and with external code. They are one of TypeScript's most useful features for large-scale applications.

```typescript
interface User {
  name: string;
  age: number;
  email?: string;
}
```
