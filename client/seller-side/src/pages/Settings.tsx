import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useShop } from "@/context/ShopContext";
import api from "@/lib/api";

interface SellerAddressForm {
  name: string;
  village: string;
  postOffice: string;
  postCode: string;
  upazila: string;
  zilla: string;
  mobileNo: string;
}

const emptySellerAddress: SellerAddressForm = {
  name: "",
  village: "",
  postOffice: "",
  postCode: "",
  upazila: "",
  zilla: "",
  mobileNo: "",
};

const trim = (value?: string | null) => (value || "").trim();

export default function Settings() {
  const { user, isAdmin, isSeller, refreshUser } = useAuth();
  const { currentShop, updateShop } = useShop();
  const [storeName, setStoreName] = useState("Flypick");
  const [storeEmail, setStoreEmail] = useState(user?.email || "");
  const [storeDescription, setStoreDescription] = useState("");
  const [sellerAddress, setSellerAddress] = useState<SellerAddressForm>(emptySellerAddress);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const showSellerAddressSection = !isAdmin && (
    isSeller ||
    user?.role?.toLowerCase?.() === "seller" ||
    !!user?.seller_profile ||
    !!currentShop
  );

  useEffect(() => {
    if (!currentShop) {
      return;
    }

    setStoreName(currentShop.name);
    setStoreDescription(currentShop.description || "");
  }, [currentShop]);

  useEffect(() => {
    setStoreEmail(user?.email || "");

    if (!user?.seller_profile) {
      setSellerAddress(emptySellerAddress);
      return;
    }

    setSellerAddress({
      name: trim(user.seller_profile.sender_name) || trim(user.username) || trim(currentShop?.name),
      village: trim(user.seller_profile.village),
      postOffice: trim(user.seller_profile.post_office),
      postCode: trim(user.seller_profile.post_code),
      upazila: trim(user.seller_profile.upazila),
      zilla: trim(user.seller_profile.zilla),
      mobileNo: trim(user.seller_profile.mobile_no) || trim(user.seller_profile.phone),
    });
  }, [currentShop?.name, user]);

  const formattedSellerAddress = useMemo(() => {
    return [
      trim(sellerAddress.village),
      trim(sellerAddress.postOffice) ? `Post Office: ${trim(sellerAddress.postOffice)}` : "",
      trim(sellerAddress.postCode) ? `Post Code: ${trim(sellerAddress.postCode)}` : "",
      [trim(sellerAddress.upazila), trim(sellerAddress.zilla)].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("\n");
  }, [sellerAddress]);

  const updateSellerAddressField = (field: keyof SellerAddressForm, value: string) => {
    setSellerAddress((current) => ({ ...current, [field]: value }));
  };

  const saveGeneral = async () => {
    setIsSavingGeneral(true);

    try {
      const requests: Promise<any>[] = [
        api.patch("/users/profile/", {
          email: trim(storeEmail),
        }),
      ];

      if (currentShop?.id) {
        requests.push(
          api.patch(`/products/shops/${currentShop.id}/`, {
            name: trim(storeName),
            description: trim(storeDescription),
          })
        );
      }

      const responses = await Promise.all(requests);
      const shopResponse = currentShop?.id ? responses[responses.length - 1] : null;

      if (currentShop?.id && shopResponse) {
        updateShop(currentShop.id, {
          name: shopResponse.data?.name || trim(storeName),
          description: shopResponse.data?.description || trim(storeDescription),
        });
      }

      await refreshUser();
      toast.success(isAdmin ? "Settings synced with database." : "Store settings synced with database.");
    } catch (error: any) {
      const data = error?.response?.data;
      const firstFieldError =
        typeof data === "object" && data
          ? Object.values(data).flat().find(Boolean)
          : null;
      toast.error(typeof firstFieldError === "string" ? firstFieldError : data?.detail || "Failed to save settings.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const saveSellerAddress = async () => {
    if (!showSellerAddressSection) {
      return;
    }

    if (!trim(sellerAddress.name) || !trim(sellerAddress.mobileNo)) {
      toast.error("Seller name and mobile number are required.");
      return;
    }

    setIsSavingAddress(true);

    try {
      await api.patch("/users/profile/", {
        seller_profile: {
          sender_name: trim(sellerAddress.name),
          mobile_no: trim(sellerAddress.mobileNo),
          phone: trim(sellerAddress.mobileNo),
          village: trim(sellerAddress.village),
          post_office: trim(sellerAddress.postOffice),
          post_code: trim(sellerAddress.postCode),
          upazila: trim(sellerAddress.upazila),
          zilla: trim(sellerAddress.zilla),
          location: [trim(sellerAddress.upazila), trim(sellerAddress.zilla)].filter(Boolean).join(", "),
          address: formattedSellerAddress,
        },
      });

      await refreshUser();
      toast.success("Seller address saved. It will now be used in print and download documents.");
    } catch (error: any) {
      const data = error?.response?.data;
      const firstFieldError =
        typeof data === "object" && data
          ? Object.values(data).flat().find(Boolean)
          : null;
      toast.error(typeof firstFieldError === "string" ? firstFieldError : data?.detail || "Failed to save seller address.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1>Settings</h1>
        <p>{isAdmin ? "Manage main admin account settings and shop information" : "Manage your shop, account, and seller address details"}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="rounded-lg bg-muted/60 p-1">
          <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
          {showSellerAddressSection ? (
            <TabsTrigger value="seller-address" className="rounded-md">Seller Address</TabsTrigger>
          ) : null}
          <TabsTrigger value="notifications" className="rounded-md">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="rounded-md">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Store Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{isAdmin ? "Main Shop Name" : "Shop Name"}</Label>
                <Input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Account Email</Label>
                <Input value={storeEmail} onChange={(event) => setStoreEmail(event.target.value)} className="rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Store Description</Label>
              <Textarea value={storeDescription} onChange={(event) => setStoreDescription(event.target.value)} className="rounded-lg" />
            </div>
            <Button onClick={saveGeneral} className="rounded-lg" disabled={isSavingGeneral}>
              {isSavingGeneral ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {showSellerAddressSection ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="section-title">Seller Address Available</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the <strong>Seller Address</strong> tab to add or edit the address used in Print or Download Documents.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {showSellerAddressSection ? (
          <TabsContent value="seller-address" className="mt-6 space-y-6">
            <div className="stat-card space-y-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="section-title">Seller Address</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add or edit your seller address. This saved address will be used automatically in the Print or Download Documents page.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={sellerAddress.name} onChange={(event) => updateSellerAddressField("name", event.target.value)} className="rounded-lg" placeholder="Seller name" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile No</Label>
                  <Input value={sellerAddress.mobileNo} onChange={(event) => updateSellerAddressField("mobileNo", event.target.value)} className="rounded-lg" placeholder="Mobile number" />
                </div>
                <div className="space-y-2">
                  <Label>Village</Label>
                  <Input value={sellerAddress.village} onChange={(event) => updateSellerAddressField("village", event.target.value)} className="rounded-lg" placeholder="Village" />
                </div>
                <div className="space-y-2">
                  <Label>Post Office</Label>
                  <Input value={sellerAddress.postOffice} onChange={(event) => updateSellerAddressField("postOffice", event.target.value)} className="rounded-lg" placeholder="Post office" />
                </div>
                <div className="space-y-2">
                  <Label>Post Code</Label>
                  <Input value={sellerAddress.postCode} onChange={(event) => updateSellerAddressField("postCode", event.target.value)} className="rounded-lg" placeholder="Post code" />
                </div>
                <div className="space-y-2">
                  <Label>Upazila</Label>
                  <Input value={sellerAddress.upazila} onChange={(event) => updateSellerAddressField("upazila", event.target.value)} className="rounded-lg" placeholder="Upazila" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Zilla</Label>
                  <Input value={sellerAddress.zilla} onChange={(event) => updateSellerAddressField("zilla", event.target.value)} className="rounded-lg" placeholder="Zilla" />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preview</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-semibold">{sellerAddress.name || "Seller name"}</p>
                  <p>{sellerAddress.mobileNo || "Mobile number"}</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{formattedSellerAddress || "Seller address will appear here."}</pre>
                </div>
              </div>

              <Button onClick={saveSellerAddress} className="rounded-lg" disabled={isSavingAddress}>
                {isSavingAddress ? "Saving..." : "Save Seller Address"}
              </Button>
            </div>
          </TabsContent>
        ) : null}

        <TabsContent value="notifications" className="mt-6 space-y-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Email Notifications</h3>
            {[
              { label: "New orders", desc: "Get notified when a new order is placed", default: true },
              { label: "Low stock alerts", desc: "Alert when product stock falls below threshold", default: true },
              { label: "New reviews", desc: "Notification for new customer reviews", default: false },
              { label: "Customer messages", desc: "New customer support messages", default: true },
              { label: "Weekly reports", desc: "Receive weekly sales summary", default: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.default} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <div className="stat-card space-y-5">
            <h3 className="section-title">Change Password</h3>
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>New Password</Label><Input type="password" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" className="rounded-lg" /></div>
            <Button onClick={() => toast.success("Password updated")} className="rounded-lg">Update Password</Button>
          </div>
          <div className="stat-card space-y-5">
            <h3 className="section-title">Two-Factor Authentication</h3>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium">Enable 2FA</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Switch />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
