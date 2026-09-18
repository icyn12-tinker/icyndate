import data from "../data/holidays/JP.json";
import { registerRegion, type RegionData } from "../holidays";
registerRegion(data as unknown as RegionData);
export default data;
