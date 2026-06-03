-- Optional ComConnect Phase 1 demo seed.
-- Run after 001_comconnect_core_foundation.sql if you want sample data.

do $$
declare
  v_org_id uuid;
  v_project_id uuid;
  v_group_id uuid;
begin
  insert into public.organisations (name, slug, support_email, support_phone)
  values ('Fledgelight Evidence Consult', 'fledgelight-evidence-consult', 'support@example.com', '+27000000000')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.projects (organisation_id, name, project_code, description, status)
  values (v_org_id, 'Demo Research + Care Project', 'DEMO-001', 'Demo project for ComConnect Phase 1', 'active')
  on conflict (organisation_id, project_code) do update set name = excluded.name
  returning id into v_project_id;

  perform public.seed_default_project_modules(v_org_id, v_project_id);

  insert into public.participants (organisation_id, project_id, participant_code, phone_number, first_name, last_name, preferred_language)
  values
    (v_org_id, v_project_id, 'DEMO-P001', '+27730000001', 'Demo', 'Participant One', 'en'),
    (v_org_id, v_project_id, 'DEMO-P002', '+27730000002', 'Demo', 'Participant Two', 'en')
  on conflict (project_id, participant_code) do nothing;

  insert into public.participant_groups (organisation_id, project_id, name, code, description)
  values (v_org_id, v_project_id, 'Demo Group', 'DEMO-GROUP', 'Example participant group')
  on conflict (project_id, code) do update set name = excluded.name
  returning id into v_group_id;

  insert into public.participant_group_memberships (organisation_id, project_id, group_id, participant_id)
  select v_org_id, v_project_id, v_group_id, p.id
  from public.participants p
  where p.project_id = v_project_id
  on conflict (group_id, participant_id) do nothing;

  insert into public.audit_logs (organisation_id, project_id, actor_type, actor_label, action, entity_type, entity_id, metadata)
  values (v_org_id, v_project_id, 'system', 'phase1_demo_seed', 'demo_seed.created', 'project', v_project_id, '{"seed":"phase1_demo_seed"}'::jsonb);
end $$;
