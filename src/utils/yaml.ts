import { parse, stringify } from 'yaml'

export function parseYaml<T = unknown>(content: string): T {
  return parse(content) as T
}

export function stringifyYaml(data: unknown): string {
  return stringify(data, { lineWidth: 120 })
}
