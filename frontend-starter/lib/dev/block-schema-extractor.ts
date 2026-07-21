import path from "path"
import { Project, SyntaxKind, Node, Type } from "ts-morph"

/**
 * Reads each block's real, current field shape directly from its TypeScript
 * source (walking out from lib/block-registry.ts) instead of from a
 * hand-maintained description of it. This project has been bitten twice by
 * hand-copied "what fields does this block have" files drifting apart
 * (block-defaults.ts in two different, disagreeing copies) — this file is
 * the deliberate alternative: there is nothing here to keep in sync, because
 * it re-derives the answer from the real code on every call.
 */

export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "array-string"
  | "array-object"
  | "unknown"

export interface FieldDescriptor {
  name: string
  optional: boolean
  kind: FieldKind
  label: string
  jsDoc?: string
  enumOptions?: string[]
  itemFields?: FieldDescriptor[]
}

export interface BlockSchema {
  key: string
  category: string
  requiredPlugin?: string
  acceptsData?: boolean
  /** True for blocks that fetch their own data server-side (e.g. announcement-bar) —
   *  these can't render inside the builder's client-side live preview. */
  isAsync: boolean
  fields: FieldDescriptor[]
  /** Set when this one block's fields couldn't be read — the other blocks in the
   *  same extraction run are unaffected; this block just falls back to raw JSON. */
  error?: string
}

// The runtime-injected live-data prop (products/categories) some blocks
// receive automatically from LandingSectionRenderer — never authored by
// hand, must never appear as an editable field or be written into config.
const RUNTIME_INJECTED_FIELD_NAMES = new Set(["data"])

function humanizeFieldName(name: string): string {
  const spaced = name.replace(/(?<!^)(?=[A-Z])/g, " ").replace(/_/g, " ")
  return spaced
    .trim()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
}

function describeType(type: Type, depth: number): Omit<FieldDescriptor, "name" | "optional" | "label" | "jsDoc"> {
  if (type.isString()) return { kind: "string" }
  if (type.isNumber()) return { kind: "number" }
  if (type.isBoolean()) return { kind: "boolean" }

  if (type.isUnion()) {
    // Optional properties resolve as `T | undefined` — strip undefined/null
    // wrappers first so an optional plain string doesn't get misread as an
    // ambiguous union just because TS represents "optional" as a union.
    const realMembers = type.getUnionTypes().filter((m) => !m.isUndefined() && !m.isNull())
    if (realMembers.length === 1) {
      return describeType(realMembers[0], depth)
    }
    const literalValues: string[] = []
    let allStringLiterals = true
    for (const member of realMembers) {
      if (member.isStringLiteral()) {
        literalValues.push(member.getLiteralValueOrThrow() as string)
      } else {
        allStringLiterals = false
        break
      }
    }
    if (allStringLiterals && literalValues.length > 0) {
      return { kind: "enum", enumOptions: literalValues }
    }
    return { kind: "unknown" }
  }

  if (type.isArray()) {
    const elementType = type.getArrayElementTypeOrThrow()
    if (elementType.isString()) return { kind: "array-string" }
    if (elementType.isObject() && !elementType.isArray() && depth < 3) {
      return { kind: "array-object", itemFields: extractFieldsFromType(elementType, depth + 1) }
    }
    return { kind: "unknown" }
  }

  return { kind: "unknown" }
}

function extractFieldsFromType(type: Type, depth: number): FieldDescriptor[] {
  const fields: FieldDescriptor[] = []
  for (const prop of type.getProperties()) {
    const name = prop.getName()
    if (RUNTIME_INJECTED_FIELD_NAMES.has(name)) continue

    const declarations = prop.getDeclarations()
    const decl = declarations[0]
    if (!decl) continue

    const propType = prop.getTypeAtLocation(decl)
    const optional = prop.isOptional()

    let jsDoc: string | undefined
    if (Node.isPropertySignature(decl)) {
      const docs = decl.getJsDocs()
      if (docs.length > 0) {
        jsDoc = docs[0].getDescription().trim() || undefined
      }
    }

    const described = describeType(propType, depth)

    fields.push({
      name,
      optional,
      label: jsDoc || humanizeFieldName(name),
      jsDoc,
      ...described,
    })
  }
  return fields
}

/** components/blocks/<category>/whatever.tsx -> "<category>"; the legacy Tri Star
 *  wrappers all live under components/blocks/landing/, which conveniently already
 *  reads as its own category ("landing") without any special-casing. */
function categoryFromFilePath(filePath: string): string {
  const match = filePath.replace(/\\/g, "/").match(/components\/blocks\/([^/]+)\//)
  return match ? match[1] : "other"
}

/** Follows an identifier through its import to the actual function that renders it, and reads that function's single props parameter's type. */
function extractFieldsForComponent(
  identifier: Node
): { fields: FieldDescriptor[]; category: string; isAsync: boolean } {
  const definitions = identifier.getSymbolOrThrow().getDeclarations()
  let target: Node | undefined
  for (const d of definitions) {
    if (Node.isImportSpecifier(d)) {
      const aliased = d.getSymbolOrThrow().getAliasedSymbol()
      const aliasedDecls = aliased?.getDeclarations() ?? []
      target = aliasedDecls[0]
      break
    }
    target = d
    break
  }
  if (!target) return { fields: [], category: "other", isAsync: false }

  const category = categoryFromFilePath(target.getSourceFile().getFilePath())

  let fn: Node | undefined
  if (Node.isFunctionDeclaration(target)) {
    fn = target
  } else if (Node.isVariableDeclaration(target)) {
    const init = target.getInitializer()
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      fn = init
    }
  }
  if (!fn || !(Node.isFunctionDeclaration(fn) || Node.isArrowFunction(fn) || Node.isFunctionExpression(fn))) {
    return { fields: [], category, isAsync: false }
  }

  // Async components fetch their own data server-side (e.g. announcement-bar
  // calling serverFetch directly) and can't be rendered inline inside a
  // client-side live-preview tree the way a plain sync component can.
  const isAsync = fn.isAsync()

  const params = fn.getParameters()
  if (params.length === 0) return { fields: [], category, isAsync }
  const propsParam = params[0]
  const paramType = propsParam.getType()
  if (!paramType.isObject()) return { fields: [], category, isAsync }
  return { fields: extractFieldsFromType(paramType, 0), category, isAsync }
}

export function extractAllBlockSchemas(): Record<string, BlockSchema> {
  const projectRoot = process.cwd()

  const project = new Project({
    tsConfigFilePath: path.join(projectRoot, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { skipLibCheck: true },
  })

  const registryPath = path.join(projectRoot, "lib", "block-registry.ts")
  const registryFile = project.addSourceFileAtPath(registryPath)

  const registryVar = registryFile.getVariableDeclarationOrThrow("BLOCK_REGISTRY")
  const initializer = registryVar.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)

  const schemas: Record<string, BlockSchema> = {}

  for (const prop of initializer.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue

    const nameNode = prop.getNameNode()
    const key = Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)
      ? nameNode.getLiteralValue()
      : nameNode.getText().replace(/^['"]|['"]$/g, "")

    const entryValue = prop.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
    if (!entryValue) continue

    let componentIdentifier: Node | undefined
    let requiredPlugin: string | undefined
    let acceptsData: boolean | undefined

    for (const entryProp of entryValue.getProperties()) {
      if (!Node.isPropertyAssignment(entryProp)) continue
      const entryPropName = entryProp.getName()
      const entryInit = entryProp.getInitializer()
      if (!entryInit) continue

      if (entryPropName === "component" && Node.isIdentifier(entryInit)) {
        componentIdentifier = entryInit
      } else if (entryPropName === "requiredPlugin" && Node.isStringLiteral(entryInit)) {
        requiredPlugin = entryInit.getLiteralValue()
      } else if (entryPropName === "acceptsData") {
        acceptsData = entryInit.getText() === "true"
      }
    }

    // One block's fields failing to read must never take the other 47 down with
    // it — each block's extraction is isolated so a problem stays local and visible
    // (a per-block error + raw-JSON fallback) instead of crashing the whole page.
    try {
      const { fields, category, isAsync } = componentIdentifier
        ? extractFieldsForComponent(componentIdentifier)
        : { fields: [], category: "other", isAsync: false }
      schemas[key] = { key, category, requiredPlugin, acceptsData, isAsync, fields }
    } catch (err) {
      schemas[key] = {
        key,
        category: "other",
        requiredPlugin,
        acceptsData,
        isAsync: false,
        fields: [],
        error: err instanceof Error ? err.message : "Could not read this block's fields",
      }
    }
  }

  return schemas
}

export { humanizeFieldName }
