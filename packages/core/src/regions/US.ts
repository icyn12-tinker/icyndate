import data from "../data/holidays/US.json";
import { registerRegion, type RegionData } from "../holidays";
registerRegion(data as unknown as RegionData);
export default data;
