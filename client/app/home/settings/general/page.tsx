
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/home/theme-toggle";

export default function GeneralSettingsPage() {

    return (
        <div className="max-w-4xl space-y-8">
            {/* Profile Section */}
            <div>
                <h2 className="text-2xl font-semibold mb-6">Profile</h2>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm text-muted-foreground">
                            Full name
                        </Label>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-medium">
                                S
                            </div>
                            <Input
                                id="fullName"
                                className="flex-1"
                                defaultValue={"Srikar"}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-sm text-muted-foreground">
                            What should we call you?
                        </Label>
                        <Input
                            id="displayName"
                            defaultValue={"Srikar"}
                        />
                    </div>
                </div>

                <div className="space-y-2 mb-6">
                    <Label htmlFor="workFunction" className="text-sm text-muted-foreground">
                        What best describes your work?
                    </Label>
                    <Select defaultValue="developer">
                        <SelectTrigger id="workFunction" className="w-full">
                            <SelectValue placeholder="Select your work function" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="designer">Designer</SelectItem>
                            <SelectItem value="product-manager">Product Manager</SelectItem>
                            <SelectItem value="data-scientist">Data Scientist</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="preferences" className="text-sm text-muted-foreground">
                        What personal preferences should we consider in responses?
                    </Label>
                </div>
            </div>

            <Separator />

            {/* Appearance Section */}
            <div>
                <h2 className="text-2xl font-semibold mb-6">Appearance</h2>
                <ThemeToggle />
            </div>
        </div>
    );
}
