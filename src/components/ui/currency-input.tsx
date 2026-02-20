import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    value: string | number
    onChange: (value: string) => void
    decimals?: number
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ className, value, onChange, decimals = 4, ...props }, ref) => {

        // Internal handler to format input
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let inputValue = e.target.value.replace(/\D/g, "")

            if (!inputValue) {
                onChange("")
                return
            }

            const numericValue = Number(inputValue) / Math.pow(10, decimals)
            const formatted = numericValue.toLocaleString("pt-BR", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })

            onChange(formatted)
        }

        return (
            <Input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={handleChange}
                className={cn("font-mono", className)}
                placeholder={`0,${"0".repeat(decimals)}`}
                ref={ref}
                {...props}
                maxLength={18} // Reasonable limit
            />
        )
    }
)
CurrencyInput.displayName = "CurrencyInput"
