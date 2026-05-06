"use client"

import * as React from "react"
import {
  Play,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  ChevronDown,
  Upload,
  X,
  ImageIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type {
  Brand,
  Product,
  Market,
  AspectRatio,
  CampaignBrief,
  LogoVariant,
} from "@/lib/cast/types"
import {
  brands,
  markets,
  getProductsForBrand,
  defaultBrief,
} from "@/lib/cast/mock-data"

interface BriefEditorProps {
  onGenerate: (brief: CampaignBrief) => void
}

const aspectRatioOptions: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1 (Square)" },
  { value: "9:16", label: "9:16 (Story)" },
  { value: "16:9", label: "16:9 (Landscape)" },
]

// Product Asset Dropzone Component
interface ProductDropzoneProps {
  product: Product
  onFileSelected: (file: File) => void
  onRemove: () => void
}

function ProductDropzone({
  product,
  onFileSelected,
  onRemove,
}: ProductDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    product.heroAssetUrl || null
  )
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelected(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onFileSelected(file)
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onRemove()
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  React.useEffect(() => {
    setPreviewUrl(product.heroAssetUrl || null)
  }, [product.heroAssetUrl])

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        id={`dropzone-${product.sku}`}
      />

      {previewUrl ? (
        // Preview State with image
        <div className="group relative">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
            <img
              src={previewUrl}
              alt={`${product.name} hero asset`}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                className="gap-1"
              >
                <X className="size-4" />
                Remove
              </Button>
            </div>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {product.heroAssetUrl ? `${product.slug}-hero.png` : "Uploaded"}
          </p>
        </div>
      ) : (
        // Empty State - Dropzone
        <label
          htmlFor={`dropzone-${product.sku}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div
            className={cn(
              "rounded-full p-3",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "size-6",
                isDragging ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drop hero image</p>
            <p className="text-xs text-muted-foreground">or click to browse</p>
          </div>
        </label>
      )}
    </div>
  )
}

// Logo Picker Component
interface LogoPickerProps {
  variants: LogoVariant[]
  selectedId: string | undefined
  defaultId: string
  onSelect: (id: string) => void
}

function LogoPicker({
  variants,
  selectedId,
  defaultId,
  onSelect,
}: LogoPickerProps) {
  const currentSelection = selectedId || defaultId

  return (
    <div className="flex flex-col gap-2">
      <Label>Logo Variant</Label>
      <div className="grid grid-cols-3 gap-3">
        {variants.map((variant) => {
          const isSelected = currentSelection === variant.id
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50"
              )}
            >
              {/* Checkered background for alpha transparency */}
              <div
                className="relative h-12 w-full overflow-hidden rounded"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
                    linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
                    linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
                  `,
                  backgroundSize: "8px 8px",
                  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                }}
              >
                <img
                  src={variant.url}
                  alt={variant.displayName}
                  className="size-full object-contain"
                />
              </div>
              <span className="text-xs font-medium">{variant.displayName}</span>
              {isSelected && (
                <div className="absolute -right-1 -top-1 rounded-full bg-primary p-0.5">
                  <Check className="size-3 text-primary-foreground" />
                </div>
              )}
              {variant.id === defaultId && !isSelected && (
                <Badge
                  variant="outline"
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]"
                >
                  Default
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BriefEditor({ onGenerate }: BriefEditorProps) {
  const [brief, setBrief] = React.useState<CampaignBrief>(defaultBrief)
  const [expandedProducts, setExpandedProducts] = React.useState<Set<string>>(
    new Set([brief.products[0]?.sku])
  )
  const [jsonMode, setJsonMode] = React.useState(false)
  const [jsonValue, setJsonValue] = React.useState("")
  const [jsonError, setJsonError] = React.useState<string | null>(null)
  const [bannedWordsWarning, setBannedWordsWarning] = React.useState<
    string | null
  >(null)

  // Banned words for pre-flight validation
  const bannedWords = ["free", "guarantee", "miracle", "instant"]

  const handleBrandChange = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId)
    if (brand) {
      const products = getProductsForBrand(brandId)
      setBrief((prev) => ({
        ...prev,
        brand,
        products,
        logoVariant: brand.defaultLogoId,
      }))
      setExpandedProducts(new Set([products[0]?.sku]))
    }
  }

  const handleLogoVariantChange = (variantId: string) => {
    setBrief((prev) => ({ ...prev, logoVariant: variantId }))
  }

  const handleMarketToggle = (market: Market) => {
    setBrief((prev) => {
      const exists = prev.markets.some((m) => m.code === market.code)
      if (exists) {
        return {
          ...prev,
          markets: prev.markets.filter((m) => m.code !== market.code),
        }
      }
      return { ...prev, markets: [...prev.markets, market] }
    })
  }

  const handleAspectRatioToggle = (ratio: AspectRatio) => {
    setBrief((prev) => {
      const exists = prev.aspectRatios.includes(ratio)
      if (exists) {
        return {
          ...prev,
          aspectRatios: prev.aspectRatios.filter((r) => r !== ratio),
        }
      }
      return { ...prev, aspectRatios: [...prev.aspectRatios, ratio] }
    })
  }

  const handleTextChange = (
    field: "headline" | "subheadline" | "cta" | "name",
    value: string
  ) => {
    setBrief((prev) => ({ ...prev, [field]: value }))

    // Check for banned words
    const foundBanned = bannedWords.filter((word) =>
      value.toLowerCase().includes(word.toLowerCase())
    )
    if (foundBanned.length > 0) {
      setBannedWordsWarning(`Contains banned words: ${foundBanned.join(", ")}`)
    } else {
      setBannedWordsWarning(null)
    }
  }

  const handleProductAssetChange = (sku: string, file: File | null) => {
    const url = file ? URL.createObjectURL(file) : undefined
    setBrief((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.sku === sku ? { ...p, heroAssetUrl: url } : p
      ),
    }))
  }

  const addProduct = () => {
    const newProduct: Product = {
      sku: `custom-${Date.now()}`,
      name: "New Product",
      slug: "new-product",
      detectedAssets: [],
    }
    setBrief((prev) => ({ ...prev, products: [...prev.products, newProduct] }))
    setExpandedProducts((prev) => new Set([...prev, newProduct.sku]))
  }

  const removeProduct = (sku: string) => {
    setBrief((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.sku !== sku),
    }))
  }

  const toggleProductExpanded = (sku: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(sku)) {
        next.delete(sku)
      } else {
        next.add(sku)
      }
      return next
    })
  }

  const handleJsonToggle = () => {
    if (!jsonMode) {
      setJsonValue(JSON.stringify(brief, null, 2))
      setJsonError(null)
    } else {
      try {
        const parsed = JSON.parse(jsonValue)
        setBrief(parsed)
        setJsonError(null)
      } catch {
        setJsonError("Invalid JSON")
        return
      }
    }
    setJsonMode(!jsonMode)
  }

  const handleJsonChange = (value: string) => {
    setJsonValue(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch {
      setJsonError("Invalid JSON")
    }
  }

  const handleGenerate = () => {
    if (jsonMode) {
      try {
        const parsed = JSON.parse(jsonValue)
        onGenerate(parsed)
      } catch {
        setJsonError("Invalid JSON - cannot generate")
        return
      }
    } else {
      onGenerate(brief)
    }
  }

  const isValid =
    brief.products.length > 0 &&
    brief.markets.length > 0 &&
    brief.aspectRatios.length > 0 &&
    brief.headline.trim() !== ""

  // Count assets status
  const productsWithAssets = brief.products.filter((p) => p.heroAssetUrl).length
  const productsWithoutAssets = brief.products.length - productsWithAssets

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={brief.brand.id} onValueChange={handleBrandChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: brand.primaryColor }}
                      />
                      {brand.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleJsonToggle}>
            {jsonMode ? "Form View" : "JSON View"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* Asset status indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="size-4" />
            <span>
              {productsWithAssets} local / {productsWithoutAssets} will generate
            </span>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!isValid || (jsonMode && !!jsonError)}
          >
            <Play className="size-4" />
            Generate Creatives
          </Button>
        </div>
      </div>

      {/* Banned Words Warning */}
      {bannedWordsWarning && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {bannedWordsWarning}
        </div>
      )}

      {jsonMode ? (
        /* JSON Editor */
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Campaign Brief JSON</CardTitle>
            <CardDescription>Edit the raw JSON configuration</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              value={jsonValue}
              onChange={(e) => handleJsonChange(e.target.value)}
              className={cn(
                "h-[500px] font-mono text-sm",
                jsonError && "border-destructive"
              )}
            />
            {jsonError && (
              <p className="mt-2 text-sm text-destructive">{jsonError}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Form Editor */
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 pr-4">
            {/* Brand & Logo Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Brand & Logo</CardTitle>
                <CardDescription>
                  Select brand identity and logo variant for all creatives
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Brand Color Swatches */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: brief.brand.primaryColor }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Primary
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: brief.brand.secondaryColor }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Secondary
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-6 rounded-full border"
                      style={{ backgroundColor: brief.brand.accentColor }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Accent
                    </span>
                  </div>
                </div>

                {/* Logo Picker */}
                <LogoPicker
                  variants={brief.brand.logoVariants}
                  selectedId={brief.logoVariant}
                  defaultId={brief.brand.defaultLogoId}
                  onSelect={handleLogoVariantChange}
                />
              </CardContent>
            </Card>

            {/* Campaign Info */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Info</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    value={brief.name}
                    onChange={(e) => handleTextChange("name", e.target.value)}
                    placeholder="Enter campaign name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={brief.headline}
                    onChange={(e) =>
                      handleTextChange("headline", e.target.value)
                    }
                    placeholder="Enter headline"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subheadline">Subheadline (optional)</Label>
                  <Input
                    id="subheadline"
                    value={brief.subheadline || ""}
                    onChange={(e) =>
                      handleTextChange("subheadline", e.target.value)
                    }
                    placeholder="Enter subheadline"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cta">CTA (optional)</Label>
                  <Input
                    id="cta"
                    value={brief.cta || ""}
                    onChange={(e) => handleTextChange("cta", e.target.value)}
                    placeholder="e.g., Shop Now"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Markets */}
            <Card>
              <CardHeader>
                <CardTitle>Markets</CardTitle>
                <CardDescription>
                  Select target markets for localization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {markets.map((market) => {
                    const isSelected = brief.markets.some(
                      (m) => m.code === market.code
                    )
                    return (
                      <Badge
                        key={market.code}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleMarketToggle(market)}
                      >
                        {isSelected && <Check className="mr-1 size-3" />}
                        {market.name}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Aspect Ratios */}
            <Card>
              <CardHeader>
                <CardTitle>Aspect Ratios</CardTitle>
                <CardDescription>Select output formats</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {aspectRatioOptions.map((ratio) => {
                    const isSelected = brief.aspectRatios.includes(ratio.value)
                    return (
                      <Badge
                        key={ratio.value}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleAspectRatioToggle(ratio.value)}
                      >
                        {isSelected && <Check className="mr-1 size-3" />}
                        {ratio.label}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Products with Dropzones */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>
                      Add hero images for each product. Missing images will be
                      generated via GenAI.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addProduct}>
                    <Plus className="size-4" />
                    Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {brief.products.map((product) => (
                  <Collapsible
                    key={product.sku}
                    open={expandedProducts.has(product.sku)}
                    onOpenChange={() => toggleProductExpanded(product.sku)}
                  >
                    <div className="rounded-lg border bg-muted/20">
                      <CollapsibleTrigger asChild>
                        <div className="flex cursor-pointer items-center justify-between p-3 hover:bg-muted/40">
                          <div className="flex items-center gap-3">
                            <ChevronDown
                              className={cn(
                                "size-4 text-muted-foreground transition-transform",
                                expandedProducts.has(product.sku) &&
                                  "rotate-180"
                              )}
                            />
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {product.heroAssetUrl ? (
                              <Badge variant="secondary">
                                <Check className="mr-1 size-3" />
                                Asset Ready
                              </Badge>
                            ) : (
                              <Badge variant="outline">Will Generate</Badge>
                            )}
                            {brief.products.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeProduct(product.sku)
                                }}
                              >
                                <Trash2 className="size-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t p-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Hero Asset Dropzone */}
                            <div className="flex flex-col gap-2">
                              <Label>Hero Asset</Label>
                              <ProductDropzone
                                product={product}
                                onFileSelected={(file) =>
                                  handleProductAssetChange(product.sku, file)
                                }
                                onRemove={() =>
                                  handleProductAssetChange(product.sku, null)
                                }
                              />
                            </div>

                            {/* Detected Assets */}
                            <div className="flex flex-col gap-2">
                              <Label>Detected Assets</Label>
                              {product.detectedAssets.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  {product.detectedAssets.map((asset) => (
                                    <div
                                      key={asset.id}
                                      className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm"
                                    >
                                      <div className="size-10 overflow-hidden rounded bg-muted">
                                        <img
                                          src={asset.url}
                                          alt={asset.filename}
                                          className="size-full object-cover"
                                        />
                                      </div>
                                      <div className="flex-1 truncate">
                                        <p className="truncate text-sm font-medium">
                                          {asset.filename}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {asset.dimensions.width} x{" "}
                                          {asset.dimensions.height}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="shrink-0">
                                        Local
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 p-4 text-center">
                                  <ImageIcon className="size-8 text-muted-foreground/50" />
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                      No local assets detected
                                    </p>
                                    <p className="text-xs text-muted-foreground/75">
                                      Will generate via GenAI
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
