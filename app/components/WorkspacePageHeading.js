import Icon from "./DashboardIcon";

export default function WorkspacePageHeading({
  locale,
  icon,
  title,
  description,
  badge,
}) {
  return (
    <div className="workspace-page-heading" data-no-translate>
      <div className="workspace-page-breadcrumb">
        {locale === "th" ? "พื้นที่วิจัย" : "Research workspace"}
        <span>/</span>
        {title}
      </div>
      <div className="workspace-page-heading-content">
        <span className={`workspace-page-icon ${icon}`}>
          <Icon name={icon} size={24} />
        </span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {badge && (
          <span className="workspace-page-badge">
            <i />
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
