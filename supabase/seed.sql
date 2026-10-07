-- Reference data. Police station locations are approximate and unverified:
-- replace with the official Ghana Police Service list before enabling the
-- police finder (MANUAL_TESTS.md, DECISIONS.md).
insert into public.police_stations (name, region, district, lat, lng, phone, verified) values
  ('Ghana Police Headquarters', 'Greater Accra', 'Accra Metropolitan', 5.5600, -0.1969, null, false),
  ('Accra Central Police Station', 'Greater Accra', 'Accra Metropolitan', 5.5480, -0.2050, null, false),
  ('Osu Police Station', 'Greater Accra', 'Korle Klottey', 5.5560, -0.1800, null, false),
  ('Madina Police Station', 'Greater Accra', 'La Nkwantanang Madina', 5.6690, -0.1660, null, false),
  ('Airport Police Station', 'Greater Accra', 'Ayawaso West', 5.6040, -0.1720, null, false),
  ('East Legon Police Station', 'Greater Accra', 'Ayawaso West', 5.6370, -0.1600, null, false),
  ('Tema Community 1 Police Station', 'Greater Accra', 'Tema Metropolitan', 5.6680, -0.0090, null, false),
  ('Kumasi Central Police Station', 'Ashanti', 'Kumasi Metropolitan', 6.6930, -1.6240, null, false),
  ('Takoradi Central Police Station', 'Western', 'Sekondi-Takoradi', 4.8960, -1.7560, null, false),
  ('Tamale Central Police Station', 'Northern', 'Tamale Metropolitan', 9.4040, -0.8420, null, false),
  ('Cape Coast Central Police Station', 'Central', 'Cape Coast Metropolitan', 5.1050, -1.2470, null, false),
  ('Ho Central Police Station', 'Volta', 'Ho Municipal', 6.6010, 0.4710, null, false)
on conflict do nothing;
