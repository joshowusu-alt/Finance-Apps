import { describe, it, expect } from "vitest";
import { suggestCategory, getConfidenceLabel } from "../categorization";

describe("categorization", () => {
    describe("suggestCategory", () => {
        it("categorizes grocery stores as allowance", () => {
            const result = suggestCategory("Tesco");
            expect(result.category).toBe("allowance");
            expect(result.confidence).toBeGreaterThan(50);
        });

        it("categorizes Sainsbury's as allowance", () => {
            const result = suggestCategory("Sainsburys");
            expect(result.category).toBe("allowance");
        });

        it("categorizes rent as bill", () => {
            const result = suggestCategory("Rent", "December Rent");
            expect(result.category).toBe("bill");
            expect(result.confidence).toBeGreaterThan(70);
        });

        it("categorizes electricity as bill", () => {
            const result = suggestCategory("Electricity", "Electricity & Gas");
            expect(result.category).toBe("bill");
        });

        it("categorizes tithe as giving", () => {
            const result = suggestCategory("FM Tithe", "Tithe");
            expect(result.category).toBe("giving");
            expect(result.confidence).toBeGreaterThan(80);
        });

        it("categorizes offerings as giving", () => {
            const result = suggestCategory("Thanksgiving Offering");
            expect(result.category).toBe("giving");
        });

        it("categorizes parents as giving", () => {
            const result = suggestCategory("Mummy J and Mummy R", "Parents");
            expect(result.category).toBe("giving");
        });

        it("categorizes savings transfer as savings", () => {
            const result = suggestCategory("Transfer to Money Box", "Savings Transfer");
            expect(result.category).toBe("savings");
        });

        it("categorizes ISA as savings", () => {
            const result = suggestCategory("Stocks and Shares ISA");
            expect(result.category).toBe("savings");
        });

        it("categorizes salary as income", () => {
            const result = suggestCategory("December Salary", "FM income");
            expect(result.category).toBe("income");
        });

        it("categorizes fuel as bill", () => {
            const result = suggestCategory("Fuel for Renault Scenic");
            expect(result.category).toBe("bill");
        });

        it("categorizes TfL as allowance", () => {
            const result = suggestCategory("Transportation - TfL");
            expect(result.category).toBe("allowance");
        });

        it("categorizes Uber as allowance", () => {
            const result = suggestCategory("Uber ride");
            expect(result.category).toBe("allowance");
        });

        it("categorizes internet as bill", () => {
            const result = suggestCategory("Community Fibre / Internet");
            expect(result.category).toBe("bill");
        });

        it("categorizes credit card payment as bill", () => {
            const result = suggestCategory("Monzo payment", "Credit Card Payment");
            expect(result.category).toBe("bill");
        });

        it("returns other for unknown merchants with low confidence", () => {
            const result = suggestCategory("Random XYZ Company");
            expect(result.category).toBe("other");
            expect(result.confidence).toBeLessThan(50);
        });

        it("returns other for empty input", () => {
            const result = suggestCategory("");
            expect(result.category).toBe("other");
            expect(result.confidence).toBe(0);
        });
    });

    describe("getConfidenceLabel", () => {
        it("returns high for 80+", () => {
            expect(getConfidenceLabel(80)).toBe("high");
            expect(getConfidenceLabel(95)).toBe("high");
        });

        it("returns medium for 50-79", () => {
            expect(getConfidenceLabel(50)).toBe("medium");
            expect(getConfidenceLabel(79)).toBe("medium");
        });

        it("returns low for below 50", () => {
            expect(getConfidenceLabel(49)).toBe("low");
            expect(getConfidenceLabel(0)).toBe("low");
        });
    });
});
