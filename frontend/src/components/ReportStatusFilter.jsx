import React from "react";
import ResponsiveSelect from "./ResponsiveSelect";

export default function ReportStatusFilter({ onChange, ...props }) {
  return <ResponsiveSelect {...props} variant="status" onChange={(event) => onChange(event.target.value)} />;
}
