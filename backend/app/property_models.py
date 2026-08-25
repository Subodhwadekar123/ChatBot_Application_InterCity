"""
InterCity Chatbot - Live SQL Server Property Models (Read-Only)
===============================================================
SQLAlchemy ORM models that map to the existing SQL Server tables.
These are STRICTLY READ-ONLY — no create_all() is ever called on them.

Tables mapped:
  - tbl_PropertyMaster   → PropertyMasterModel
  - tbl_PropertyDetails  → PropertyDetailsModel
  - tbl_EstateTypes      → EstateTypeModel
  - tbl_DealingTypes     → DealingTypeModel
  - tbl_PropertyTypes    → PropertyTypeModel
  - tbl_BHKTypes         → BHKTypeModel
  - tbl_FurnishedTypes   → FurnishedTypeModel
  - tbl_ParkingTypes     → ParkingTypeModel
  - tbl_PossessionTypes  → PossessionTypeModel
  - tbl_PropertyStatusTypes → PropertyStatusTypeModel
  - tbl_Area             → AreaModel
"""

from sqlalchemy import Column, String, Integer, BigInteger, Float, DateTime, Boolean, DECIMAL
from sqlalchemy.ext.declarative import declarative_base

# Separate Base for live SQL Server tables — never used with create_all()
LiveBase = declarative_base()


# ── Lookup / Reference Tables ────────────────────────────────────────────────

class EstateTypeModel(LiveBase):
    """Lookup: Residential / Commercial"""
    __tablename__ = "tbl_EstateTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class DealingTypeModel(LiveBase):
    """Lookup: Sale / Rent"""
    __tablename__ = "tbl_DealingTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class PropertyTypeModel(LiveBase):
    """Lookup: Flat, Villa, Row House, etc."""
    __tablename__ = "tbl_PropertyTypes"

    Id = Column(Integer, primary_key=True)
    EstateTypeId = Column(Integer)
    Name = Column(String(50))
    SortId = Column(Integer)
    IsActive = Column(Boolean)


class BHKTypeModel(LiveBase):
    """Lookup: 1BHK, 2BHK, 3BHK, etc."""
    __tablename__ = "tbl_BHKTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class FurnishedTypeModel(LiveBase):
    """Lookup: Furnished, Semi-Furnished, Unfurnished"""
    __tablename__ = "tbl_FurnishedTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class ParkingTypeModel(LiveBase):
    """Lookup: Open, Covered, None, etc."""
    __tablename__ = "tbl_ParkingTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class PossessionTypeModel(LiveBase):
    """Lookup: Ready to Move / Under Construction"""
    __tablename__ = "tbl_PossessionTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class PropertyStatusTypeModel(LiveBase):
    """Lookup: Property status types"""
    __tablename__ = "tbl_PropertyStatusTypes"

    Id = Column(Integer, primary_key=True)
    Name = Column(String(50))
    IsActive = Column(Boolean)


class AreaModel(LiveBase):
    """Area / locality master with geo-coordinates."""
    __tablename__ = "tbl_Area"

    Id = Column(Integer, primary_key=True)
    Area = Column(String(300))
    City = Column(String(200))
    State = Column(String(200))
    Country = Column(String(100))
    Latitude = Column(DECIMAL(8, 6))
    Longitude = Column(DECIMAL(9, 6))
    IsActive = Column(Boolean)


# ── Core Property Tables ─────────────────────────────────────────────────────

class PropertyMasterModel(LiveBase):
    """
    Master record for every property listing.
    Links to lookup tables via foreign key IDs.
    """
    __tablename__ = "tbl_PropertyMaster"

    Id = Column(BigInteger, primary_key=True)
    EstateTypeId = Column(Integer)
    DealingTypeId = Column(Integer)
    PropertyStatusTypeId = Column(Integer)
    PropertyTypeId = Column(Integer)
    PossessionTypeId = Column(Integer)
    BHKTypeId = Column(Integer)
    FurnishedTypeId = Column(Integer)
    ParkingTypeId = Column(Integer)
    UserId = Column(BigInteger)
    Latitude = Column(DECIMAL(8, 6))
    Longitude = Column(DECIMAL(9, 6))
    EntryDate = Column(DateTime)
    IsActive = Column(Boolean)
    BudgetRangeFrom = Column(Float)
    BudgetRangeTo = Column(Float)
    FloorID = Column(Integer)
    ClientTypeID = Column(Integer)
    IsExpired = Column(Boolean)
    RepostDate = Column(DateTime)
    MainUserid = Column(Integer)


class PropertyDetailsModel(LiveBase):
    """
    Extended property details — one-to-one with PropertyMaster via PropMasterId.
    Contains the actual property information: name, area, price, amenities, etc.
    """
    __tablename__ = "tbl_PropertyDetails"

    Id = Column(BigInteger, primary_key=True)
    PropMasterId = Column(BigInteger)
    OwnerName = Column(String(250))
    PropertyName = Column(String(150))
    PropDesc = Column(String(150))
    ExpectedAmt = Column(DECIMAL(18, 0))
    ExpectedDeposite = Column(DECIMAL(18, 0))
    CarpetArea = Column(Float)
    CarpetArea2 = Column(Float)
    AvailableFor = Column(String(500))
    AreaIn = Column(String(50))
    PossessionDate = Column(DateTime)
    Country = Column(String(50))
    State = Column(String(50))
    City = Column(String(50))
    Area = Column(String(255))
    Ageofproperty = Column(String(10))
    ParkingCount = Column(String(10))
    LiftCount = Column(String(10))
    FloorCount = Column(String(10))
    BalconiesCount = Column(String(10))
    DoorDirection = Column(String(500))
    WingCount = Column(String(10))
    VastuCompliant = Column(String)
    KeyWith = Column(String)
    UnitNo = Column(String(500))
    Wing = Column(String)
    FlooreNo = Column(String(50))
    LandMark = Column(String(500))
    Amenities = Column(String)
    PlotArea = Column(String(300))
    AreaInPlot = Column(String(300))
    BedRooms = Column(String(300))
    BathRooms = Column(String(300))
    TypeOfFurnished = Column(String(300))
    AreaInSaleable = Column(String(300))
    SalebleArea = Column(String(300))
    AreaInCarpet = Column(String(300))
    CabinCount = Column(String(10))
    ToiletCount = Column(String(10))
    pantryCount = Column(String(10))
    WorkStation = Column(String(10))
    ConferenceCount = Column(String(10))
    SeatersCount = Column(String(10))
    ServerRoomCount = Column(String(10))
    MeetingRoomCount = Column(String(10))
    TwoWheelerParkingCount = Column(String(10))
    PropertyHeight = Column(String(10))
    Frontage = Column(String(10))
    SuitableFor = Column(String(10))
    IsActive = Column(Boolean)
    # ClientContactNo is SENSITIVE — never exposed via chatbot
    ClientContactNo = Column(String(50))
